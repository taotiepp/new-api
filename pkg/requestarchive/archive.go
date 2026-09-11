// Package requestarchive appends independent request/response archives to JSONL
// files. It does not use the application's databases or consumption logs.
package requestarchive

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Default is initialized before the HTTP routes are registered. A nil archive
// disables collection completely, including allocation of body buffers.
var Default *Archive

type Config struct {
	Directory     string
	MaxBodyBytes  int
	RetentionDays int   // Zero disables age-based deletion.
	MaxFileBytes  int64 // Zero disables size rotation; a single record is never split.
	MaxFiles      int   // Zero disables file-count cleanup; includes the current file.
}

// Entry stores bodies as nested JSON rather than escaped JSON strings. Every
// physical line is one self-contained request, even for multiline model output.
type Entry struct {
	Version       int             `json:"version"`
	RequestID     string          `json:"request_id"`
	UserID        int             `json:"user_id"`
	TokenID       int             `json:"token_id"`
	ChannelID     int             `json:"channel_id"`
	Model         string          `json:"model"`
	CreatedAt     int64           `json:"created_at"`
	Method        string          `json:"method"`
	Path          string          `json:"path"`
	StatusCode    int             `json:"status_code"`
	DurationMs    int64           `json:"duration_ms"`
	Stream        bool            `json:"stream"`
	RequestState  string          `json:"request_state"`
	ResponseState string          `json:"response_state"`
	Request       json.RawMessage `json:"request,omitempty"`
	Response      json.RawMessage `json:"response,omitempty"`
}

type Archive struct {
	config Config
	mu     sync.Mutex
	file   *os.File
	day    string
	size   int64
	closed bool
	done   chan struct{}
}

var archiveFilename = regexp.MustCompile(`^requests-(\d{4}-\d{2}-\d{2})-[A-Z2-7]{26}\.jsonl$`)

// OpenFromEnv validates opt-in configuration. Disabled archiving has no file
// system side effects. Directory and file failures surface during startup.
func OpenFromEnv() (*Archive, error) {
	enabled := os.Getenv("REQUEST_ARCHIVE_ENABLED")
	if enabled == "" || enabled == "false" {
		return nil, nil
	}
	if enabled != "true" {
		return nil, errors.New("REQUEST_ARCHIVE_ENABLED must be true or false")
	}
	config := Config{Directory: "./data/request-archives", MaxBodyBytes: 1 << 20}
	if directory := os.Getenv("REQUEST_ARCHIVE_DIR"); directory != "" {
		config.Directory = directory
	}
	for name, target := range map[string]*int{
		"REQUEST_ARCHIVE_MAX_BODY_BYTES": &config.MaxBodyBytes,
		"REQUEST_ARCHIVE_RETENTION_DAYS": &config.RetentionDays,
		"REQUEST_ARCHIVE_MAX_FILES":      &config.MaxFiles,
	} {
		if value := os.Getenv(name); value != "" {
			parsed, err := strconv.Atoi(value)
			if err != nil {
				return nil, fmt.Errorf("invalid %s: expected an integer", name)
			}
			*target = parsed
		}
	}
	if value := os.Getenv("REQUEST_ARCHIVE_MAX_FILE_SIZE"); value != "" {
		value = strings.ToUpper(strings.TrimSpace(value))
		megabytes, hasMB := strings.CutSuffix(value, "MB")
		gigabytes, hasGB := strings.CutSuffix(value, "GB")
		var multiplier int64 = 1
		switch {
		case hasMB:
			value = strings.TrimSpace(megabytes)
			multiplier = 1 << 20
		case hasGB:
			value = strings.TrimSpace(gigabytes)
			multiplier = 1 << 30
		case value != "0":
			return nil, errors.New("REQUEST_ARCHIVE_MAX_FILE_SIZE must be 0 or a whole number with MB/GB units")
		}
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed < 0 || parsed > math.MaxInt64/multiplier {
			return nil, errors.New("REQUEST_ARCHIVE_MAX_FILE_SIZE is invalid or exceeds the supported size")
		}
		config.MaxFileBytes = parsed * multiplier
	}
	return Open(config)
}

func Open(config Config) (*Archive, error) {
	if config.Directory == "" {
		return nil, errors.New("request archive directory is required")
	}
	if config.MaxBodyBytes < 1024 || config.MaxBodyBytes > 16<<20 {
		return nil, errors.New("request archive body limit must be between 1024 and 16777216 bytes")
	}
	if config.RetentionDays < 0 || config.RetentionDays > 36500 {
		return nil, errors.New("request archive retention must be between 0 and 36500 days")
	}
	if config.MaxFileBytes < 0 || config.MaxFiles < 0 {
		return nil, errors.New("request archive file size and count limits must be non-negative")
	}
	directory, err := filepath.Abs(config.Directory)
	if err != nil {
		return nil, err
	}
	config.Directory = directory
	if err := os.MkdirAll(directory, 0700); err != nil {
		return nil, fmt.Errorf("create request archive directory: %w", err)
	}
	archive := &Archive{config: config, done: make(chan struct{})}
	if err := archive.rotate(time.Now().UTC().Format(time.DateOnly)); err != nil {
		return nil, err
	}
	if config.RetentionDays > 0 || config.MaxFiles > 0 {
		go archive.cleanupLoop()
	}
	return archive, nil
}

func (a *Archive) MaxBodyBytes() int { return a.config.MaxBodyBytes }

func (a *Archive) rotate(day string) error {
	if a.file != nil {
		err := a.file.Close()
		a.file = nil
		if err != nil {
			return err
		}
	}
	// Each process/day gets a unique file. O_EXCL avoids following a preexisting
	// symlink and prevents concurrent replicas from interleaving JSONL records.
	name := "requests-" + day + "-" + rand.Text() + ".jsonl"
	file, err := os.OpenFile(filepath.Join(a.config.Directory, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return fmt.Errorf("open request archive: %w", err)
	}
	a.file, a.day, a.size = file, day, 0
	if a.config.MaxFiles > 0 {
		// Cleanup failures must not prevent the newly opened file from recording.
		if err := a.cleanupLocked(time.Now(), false); err != nil {
			common.SysError("request archive cleanup failed: " + err.Error())
		}
	}
	return nil
}

func (a *Archive) Append(entry Entry) error {
	entry.Version = 1
	if entry.CreatedAt == 0 {
		entry.CreatedAt = time.Now().Unix()
	}
	if len(entry.Response) > a.config.MaxBodyBytes {
		entry.Response, entry.ResponseState = nil, "too_large"
	}
	data, err := common.Marshal(entry)
	if err != nil {
		return fmt.Errorf("encode request archive: %w", err)
	}
	data = append(data, '\n')
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return os.ErrClosed
	}
	day := time.Unix(entry.CreatedAt, 0).UTC().Format(time.DateOnly)
	sizeRotation := a.config.MaxFileBytes > 0 && a.size > 0 &&
		(a.size >= a.config.MaxFileBytes || int64(len(data)) > a.config.MaxFileBytes-a.size)
	if a.file == nil || a.day != day || sizeRotation {
		if err := a.rotate(day); err != nil {
			return err
		}
	}
	n, err := a.file.Write(data)
	if err == nil && n != len(data) {
		err = io.ErrShortWrite
	}
	if err != nil {
		// A failed append must not leave a partial JSON object that corrupts the
		// next line. Future writes start a fresh file if rollback also fails.
		if truncateErr := a.file.Truncate(a.size); truncateErr != nil {
			_ = a.file.Close()
			a.file = nil
			return fmt.Errorf("append request archive: %w; rollback: %v", err, truncateErr)
		}
		return fmt.Errorf("append request archive: %w", err)
	}
	a.size += int64(n)
	return nil
}

// Cleanup applies age and file-count limits to recognized archive files.
// The current file is protected from count-based deletion.
func (a *Archive) Cleanup(now time.Time) error {
	if a.config.RetentionDays == 0 && a.config.MaxFiles == 0 {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return os.ErrClosed
	}
	return a.cleanupLocked(now, true)
}

// cleanupLocked is also used during rotation while the writer lock is held.
func (a *Archive) cleanupLocked(now time.Time, applyAge bool) error {
	files, err := os.ReadDir(a.config.Directory)
	if err != nil {
		return err
	}
	cutoff := now.UTC().AddDate(0, 0, -a.config.RetentionDays).Format(time.DateOnly)
	if applyAge && a.config.RetentionDays > 0 && a.file != nil && a.day < cutoff {
		err := a.file.Close()
		a.file = nil
		if err != nil {
			return err
		}
	}
	var retained []os.FileInfo
	for _, file := range files {
		if !file.Type().IsRegular() {
			continue
		}
		matches := archiveFilename.FindStringSubmatch(file.Name())
		if len(matches) != 2 {
			continue
		}
		if _, err := time.Parse(time.DateOnly, matches[1]); err != nil {
			continue
		}
		path := filepath.Join(a.config.Directory, file.Name())
		if a.file != nil && path == a.file.Name() {
			continue
		}
		if applyAge && a.config.RetentionDays > 0 && matches[1] < cutoff {
			if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
			continue
		}
		info, err := file.Info()
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return err
		}
		retained = append(retained, info)
	}
	if a.config.MaxFiles > 0 {
		slots := a.config.MaxFiles
		if a.file != nil {
			slots--
		}
		slices.SortFunc(retained, func(left, right os.FileInfo) int {
			if order := left.ModTime().Compare(right.ModTime()); order != 0 {
				return order
			}
			return strings.Compare(left.Name(), right.Name())
		})
		for _, file := range retained[:max(0, len(retained)-slots)] {
			if err := os.Remove(filepath.Join(a.config.Directory, file.Name())); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
		}
	}
	return nil
}

func (a *Archive) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if err := a.Cleanup(time.Now()); err != nil && !errors.Is(err, os.ErrClosed) {
			common.SysError("request archive cleanup failed: " + err.Error())
		}
		select {
		case <-a.done:
			return
		case <-ticker.C:
		}
	}
}

func (a *Archive) Close() error {
	if a == nil {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return nil
	}
	a.closed = true
	close(a.done)
	if a.file == nil {
		return nil
	}
	syncErr := a.file.Sync()
	closeErr := a.file.Close()
	return errors.Join(syncErr, closeErr)
}

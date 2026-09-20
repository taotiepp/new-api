package cli

import (
	"bufio"
	"crypto/subtle"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"syscall"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/joho/godotenv"
	"golang.org/x/term"
)

const (
	defaultResetUsername = "root"
	defaultEnvFile       = ".env"
	resetPasswordEnvName = "NEW_API_RESET_PASSWORD"
)

type resetPasswordOptions struct {
	username      string
	envFile       string
	password      string
	passwordStdin bool
}

type resetPasswordRuntime struct {
	loadEnv       func(path string) error
	initResources func() error
	closeDB       func() error
	resetPassword func(username, password string) error
	afterReset    func(username string, stderr io.Writer) error
	lookupEnv     func(key string) (string, bool)
	stdin         io.Reader
	isTerminal    func() bool
	readPassword  func(prompt string) (string, error)
}

func RunResetPassword(args []string, stdout, stderr io.Writer) int {
	return runResetPassword(args, stdout, stderr, defaultResetPasswordRuntime(stderr))
}

func defaultResetPasswordRuntime(stderr io.Writer) resetPasswordRuntime {
	return resetPasswordRuntime{
		loadEnv:       loadEnvFile,
		initResources: initResetPasswordResources,
		closeDB:       model.CloseDB,
		resetPassword: model.ResetUserPasswordByUsername,
		afterReset:    warnAndAuditPasswordReset,
		lookupEnv:     os.LookupEnv,
		stdin:         os.Stdin,
		isTerminal: func() bool {
			return term.IsTerminal(int(os.Stdin.Fd()))
		},
		readPassword: func(prompt string) (string, error) {
			fmt.Fprint(stderr, prompt)
			secret, err := term.ReadPassword(int(syscall.Stdin))
			fmt.Fprintln(stderr)
			if err != nil {
				return "", err
			}
			return string(secret), nil
		},
	}
}

func runResetPassword(args []string, stdout, stderr io.Writer, runtime resetPasswordRuntime) int {
	options, err := parseResetPasswordArgs(args, stderr)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	password, err := resolveResetPassword(options, runtime)
	if err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	if err := common.ValidateNewAccountPassword(password); err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	if err := runtime.loadEnv(options.envFile); err != nil {
		fmt.Fprintf(stderr, "load env file: %v\n", err)
		return 1
	}
	if err := runtime.initResources(); err != nil {
		fmt.Fprintf(stderr, "initialize database: %v\n", err)
		return 1
	}
	defer func() {
		if runtime.closeDB == nil {
			return
		}
		if closeErr := runtime.closeDB(); closeErr != nil {
			fmt.Fprintf(stderr, "close database: %v\n", closeErr)
		}
	}()
	if err := runtime.resetPassword(options.username, password); err != nil {
		fmt.Fprintf(stderr, "reset password: %v\n", err)
		return 1
	}
	if runtime.afterReset != nil {
		if err := runtime.afterReset(options.username, stderr); err != nil {
			fmt.Fprintf(stderr, "warning: %v\n", err)
		}
	}
	fmt.Fprintf(stdout, "password updated for %q; existing sessions were revoked\n", options.username)
	return 0
}

func parseResetPasswordArgs(args []string, stderr io.Writer) (resetPasswordOptions, error) {
	flags := flag.NewFlagSet("reset-password", flag.ContinueOnError)
	flags.SetOutput(stderr)
	flags.Usage = func() {
		fmt.Fprintln(stderr, "usage: new-api reset-password [flags]")
		fmt.Fprintln(stderr, "")
		fmt.Fprintln(stderr, "Reset an account password using the same .env file and environment")
		fmt.Fprintln(stderr, "variables as the server (SQL_DSN, SQLITE_PATH, REDIS_CONN_STRING, ...).")
		fmt.Fprintln(stderr, "Existing environment variables take precedence over the env file.")
		fmt.Fprintln(stderr, "")
		fmt.Fprintln(stderr, "Provide the new password with --password-stdin, NEW_API_RESET_PASSWORD,")
		fmt.Fprintln(stderr, "--password, or an interactive prompt. --password is visible in process lists.")
		fmt.Fprintln(stderr, "")
		flags.PrintDefaults()
	}
	username := flags.String("username", defaultResetUsername, "account username to reset")
	envFile := flags.String("env-file", defaultEnvFile, "env file to load; set empty to skip")
	password := flags.String("password", "", "new password (visible in process lists)")
	passwordStdin := flags.Bool("password-stdin", false, "read the new password from stdin")
	if err := flags.Parse(args); err != nil {
		return resetPasswordOptions{}, err
	}
	if flags.NArg() != 0 {
		return resetPasswordOptions{}, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	options := resetPasswordOptions{
		username:      strings.TrimSpace(*username),
		envFile:       *envFile,
		password:      *password,
		passwordStdin: *passwordStdin,
	}
	if options.username == "" {
		return resetPasswordOptions{}, errors.New("username is required")
	}
	return options, nil
}

func resolveResetPassword(options resetPasswordOptions, runtime resetPasswordRuntime) (string, error) {
	envPassword, envSet := "", false
	if runtime.lookupEnv != nil {
		envPassword, envSet = runtime.lookupEnv(resetPasswordEnvName)
	}
	sources := 0
	if options.password != "" {
		sources++
	}
	if options.passwordStdin {
		sources++
	}
	if envSet && envPassword != "" {
		sources++
	}
	if sources > 1 {
		return "", errors.New("provide the new password via only one of --password, --password-stdin, or NEW_API_RESET_PASSWORD")
	}
	switch {
	case options.password != "":
		return options.password, nil
	case options.passwordStdin:
		return readPasswordFromStdin(runtime.stdin)
	case envSet && envPassword != "":
		return envPassword, nil
	case runtime.isTerminal != nil && runtime.isTerminal():
		return readPasswordInteractively(runtime)
	default:
		return "", errors.New("new password is required; use --password-stdin, NEW_API_RESET_PASSWORD, --password, or a terminal prompt")
	}
}

func readPasswordFromStdin(stdin io.Reader) (string, error) {
	if stdin == nil {
		return "", errors.New("stdin is unavailable")
	}
	password, err := bufio.NewReader(stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	password = strings.TrimSuffix(password, "\n")
	password = strings.TrimSuffix(password, "\r")
	if password == "" {
		return "", errors.New("new password is empty")
	}
	return password, nil
}

func readPasswordInteractively(runtime resetPasswordRuntime) (string, error) {
	if runtime.readPassword == nil {
		return "", errors.New("interactive password prompt is unavailable")
	}
	password, err := runtime.readPassword("New password: ")
	if err != nil {
		return "", err
	}
	confirm, err := runtime.readPassword("Confirm password: ")
	if err != nil {
		return "", err
	}
	if subtle.ConstantTimeCompare([]byte(password), []byte(confirm)) != 1 {
		return "", errors.New("passwords do not match")
	}
	if password == "" {
		return "", errors.New("new password is empty")
	}
	return password, nil
}

func loadEnvFile(path string) error {
	if path == "" {
		return nil
	}
	err := godotenv.Load(path)
	if err == nil {
		return nil
	}
	if path == defaultEnvFile && errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func initResetPasswordResources() error {
	if sqlitePath := os.Getenv("SQLITE_PATH"); sqlitePath != "" {
		common.SQLitePath = sqlitePath
	}
	common.DebugEnabled = os.Getenv("DEBUG") == "true"
	// Skip AutoMigrate: this command only updates an existing account.
	common.IsMasterNode = false
	if err := model.InitDB(); err != nil {
		return err
	}
	if err := model.InitLogDB(); err != nil {
		return err
	}
	return common.InitRedisClient()
}

func warnAndAuditPasswordReset(username string, stderr io.Writer) error {
	user, err := model.GetUserByUsername(username)
	if err != nil {
		return err
	}
	enabled, err := model.IsTwoFAEnabled(user.Id)
	if err != nil {
		return err
	}
	if enabled {
		fmt.Fprintln(stderr, "warning: two-factor authentication is still enabled for this account")
	}
	model.RecordAuditLog(nil, model.AuditLog{
		UserId:     user.Id,
		Username:   user.Username,
		ActorRole:  user.Role,
		Category:   model.AuditCategorySecurity,
		Action:     "user.password_change",
		Content:    "Account password change",
		AuthMethod: "cli",
		Success:    true,
		Other: model.AuditOther{
			Op: &model.AuditOperation{
				Action: "user.password_change",
				Params: model.AuditFields{"source": "cli"},
			},
		},
	})
	return nil
}

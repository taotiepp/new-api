package cli

import (
	"bytes"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseResetPasswordArgs(t *testing.T) {
	var stderr bytes.Buffer
	options, err := parseResetPasswordArgs([]string{
		"--username", "admin",
		"--env-file", "/tmp/custom.env",
		"--password-stdin",
	}, &stderr)
	require.NoError(t, err)
	assert.Equal(t, "admin", options.username)
	assert.Equal(t, "/tmp/custom.env", options.envFile)
	assert.True(t, options.passwordStdin)

	options, err = parseResetPasswordArgs(nil, &stderr)
	require.NoError(t, err)
	assert.Equal(t, defaultResetUsername, options.username)
	assert.Equal(t, defaultEnvFile, options.envFile)

	_, err = parseResetPasswordArgs([]string{"--username", ""}, &stderr)
	require.Error(t, err)

	_, err = parseResetPasswordArgs([]string{"extra"}, &stderr)
	require.Error(t, err)
}

func TestRunResetPasswordUsesEnvFileAndStdin(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var loadedPath, resetUsername, resetPassword string

	code := runResetPassword([]string{
		"--username", "root",
		"--env-file", "deploy.env",
		"--password-stdin",
	}, &stdout, &stderr, resetPasswordRuntime{
		loadEnv: func(path string) error {
			loadedPath = path
			return nil
		},
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		resetPassword: func(username, password string) error {
			resetUsername = username
			resetPassword = password
			return nil
		},
		lookupEnv: func(string) (string, bool) { return "", false },
		stdin:     strings.NewReader("NewPassword123\n"),
		isTerminal: func() bool {
			return false
		},
	})

	assert.Equal(t, 0, code)
	assert.Equal(t, "deploy.env", loadedPath)
	assert.Equal(t, "root", resetUsername)
	assert.Equal(t, "NewPassword123", resetPassword)
	assert.Contains(t, stdout.String(), `"root"`)
	assert.NotContains(t, stdout.String(), "NewPassword123")
	assert.NotContains(t, stderr.String(), "NewPassword123")
}

func TestRunResetPasswordRejectsConflictingPasswordSources(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := runResetPassword([]string{"--password", "NewPassword123", "--password-stdin"}, &stdout, &stderr, resetPasswordRuntime{
		lookupEnv: func(string) (string, bool) { return "", false },
		stdin:     strings.NewReader("OtherPassword123\n"),
		isTerminal: func() bool {
			return false
		},
	})
	assert.Equal(t, 2, code)
	assert.Contains(t, stderr.String(), "only one")
}

func TestRunResetPasswordReadsEnvPassword(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var resetPassword string
	code := runResetPassword(nil, &stdout, &stderr, resetPasswordRuntime{
		loadEnv:       func(string) error { return nil },
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		resetPassword: func(_, password string) error {
			resetPassword = password
			return nil
		},
		lookupEnv: func(key string) (string, bool) {
			if key == resetPasswordEnvName {
				return "EnvPassword123", true
			}
			return "", false
		},
		isTerminal: func() bool { return false },
	})
	assert.Equal(t, 0, code)
	assert.Equal(t, "EnvPassword123", resetPassword)
}

func TestRunResetPasswordEnforcesPasswordPolicy(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := runResetPassword([]string{"--password", "short"}, &stdout, &stderr, resetPasswordRuntime{
		lookupEnv:  func(string) (string, bool) { return "", false },
		isTerminal: func() bool { return false },
	})
	assert.Equal(t, 2, code)
	assert.ErrorIs(t, common.ValidateNewAccountPassword("short"), common.ErrAccountPasswordLength)
	assert.Contains(t, stderr.String(), common.ErrAccountPasswordLength.Error())
}

func TestRunResetPasswordInteractiveMismatch(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	prompts := 0
	code := runResetPassword(nil, &stdout, &stderr, resetPasswordRuntime{
		lookupEnv:  func(string) (string, bool) { return "", false },
		isTerminal: func() bool { return true },
		readPassword: func(string) (string, error) {
			prompts++
			if prompts == 1 {
				return "NewPassword123", nil
			}
			return "OtherPassword123", nil
		},
	})
	assert.Equal(t, 2, code)
	assert.Contains(t, stderr.String(), "do not match")
}

func TestLoadEnvFile(t *testing.T) {
	require.NoError(t, loadEnvFile(""))
	t.Chdir(t.TempDir())
	require.NoError(t, loadEnvFile(defaultEnvFile))
	require.Error(t, loadEnvFile("missing-reset-password.env"))
}

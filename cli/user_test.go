package cli

import (
	"bytes"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseUserCreateArgs(t *testing.T) {
	var stderr bytes.Buffer
	options, err := parseUserCreateArgs([]string{
		"--username", "alice",
		"--role", "admin",
		"--display-name", "Alice",
		"--password-stdin",
	}, &stderr)
	require.NoError(t, err)
	assert.Equal(t, "alice", options.username)
	assert.Equal(t, "Alice", options.displayName)
	assert.Equal(t, common.RoleAdminUser, options.role)
	assert.Equal(t, roleAdmin, options.roleName)
	assert.True(t, options.passwordStdin)

	_, err = parseUserCreateArgs([]string{"--username", "alice", "--role", "root"}, &stderr)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "root")

	_, err = parseUserCreateArgs([]string{"--role", "user"}, &stderr)
	require.Error(t, err)
}

func TestParseUserSetRoleArgs(t *testing.T) {
	var stderr bytes.Buffer
	options, err := parseUserSetRoleArgs([]string{"--username", "alice", "--role", "user"}, &stderr)
	require.NoError(t, err)
	assert.Equal(t, "alice", options.username)
	assert.Equal(t, common.RoleCommonUser, options.role)

	_, err = parseUserSetRoleArgs([]string{"--username", "alice"}, &stderr)
	require.Error(t, err)
}

func TestRunUserCreateUsesStdinPassword(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var createdUser, createdPassword, createdDisplay string
	var createdRole int

	code := runUser([]string{"create", "--username", "alice", "--role", "admin", "--password-stdin"}, &stdout, &stderr, userCommandRuntime{
		loadEnv:       func(string) error { return nil },
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		createUser: func(username, password, displayName string, role int) (*model.User, error) {
			createdUser = username
			createdPassword = password
			createdDisplay = displayName
			createdRole = role
			return &model.User{Id: 7, Username: username, Role: role}, nil
		},
		lookupEnv:  func(string) (string, bool) { return "", false },
		stdin:      strings.NewReader("NewPassword123\n"),
		isTerminal: func() bool { return false },
	})

	assert.Equal(t, 0, code)
	assert.Equal(t, "alice", createdUser)
	assert.Equal(t, "NewPassword123", createdPassword)
	assert.Empty(t, createdDisplay)
	assert.Equal(t, common.RoleAdminUser, createdRole)
	assert.Contains(t, stdout.String(), `"alice"`)
	assert.Contains(t, stdout.String(), "admin")
	assert.NotContains(t, stdout.String(), "NewPassword123")
}

func TestRunUserCreateReadsEnvPassword(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var createdPassword string
	code := runUser([]string{"create", "--username", "bob", "--role", "user"}, &stdout, &stderr, userCommandRuntime{
		loadEnv:       func(string) error { return nil },
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		createUser: func(_, password, _ string, _ int) (*model.User, error) {
			createdPassword = password
			return &model.User{Id: 8, Username: "bob", Role: common.RoleCommonUser}, nil
		},
		lookupEnv: func(key string) (string, bool) {
			if key == createPasswordEnvName {
				return "EnvPassword123", true
			}
			return "", false
		},
		isTerminal: func() bool { return false },
	})
	assert.Equal(t, 0, code)
	assert.Equal(t, "EnvPassword123", createdPassword)
}

func TestRunUserSetRole(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var setUsername string
	var setRole int
	code := runUser([]string{"set-role", "--username", "alice", "--role", "admin"}, &stdout, &stderr, userCommandRuntime{
		loadEnv:       func(string) error { return nil },
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		setRole: func(username string, role int) (int, *model.User, error) {
			setUsername = username
			setRole = role
			return common.RoleCommonUser, &model.User{Username: username, Role: role}, nil
		},
	})
	assert.Equal(t, 0, code)
	assert.Equal(t, "alice", setUsername)
	assert.Equal(t, common.RoleAdminUser, setRole)
	assert.Contains(t, stdout.String(), "admin")
}

func TestRunUserSetPasswordDelegates(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	var resetUsername, resetPassword string
	code := runUser([]string{"set-password", "--username", "alice", "--password-stdin"}, &stdout, &stderr, userCommandRuntime{
		loadEnv:       func(string) error { return nil },
		initResources: func() error { return nil },
		closeDB:       func() error { return nil },
		resetPassword: func(username, password string) error {
			resetUsername = username
			resetPassword = password
			return nil
		},
		lookupEnv:  func(string) (string, bool) { return "", false },
		stdin:      strings.NewReader("NewPassword123\n"),
		isTerminal: func() bool { return false },
	})
	assert.Equal(t, 0, code)
	assert.Equal(t, "alice", resetUsername)
	assert.Equal(t, "NewPassword123", resetPassword)
}

func TestRunUserUnknownCommand(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	assert.Equal(t, 2, runUser(nil, &stdout, &stderr, userCommandRuntime{}))
	assert.Equal(t, 2, runUser([]string{"delete"}, &stdout, &stderr, userCommandRuntime{}))
	assert.Contains(t, stderr.String(), "usage:")
}

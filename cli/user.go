package cli

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"gorm.io/gorm"
)

const (
	createPasswordEnvName = "NEW_API_USER_PASSWORD"
	roleUser              = "user"
	roleAdmin             = "admin"
)

type userCreateOptions struct {
	username      string
	displayName   string
	role          int
	roleName      string
	envFile       string
	password      string
	passwordStdin bool
}

type userSetRoleOptions struct {
	username string
	role     int
	roleName string
	envFile  string
}

type userCommandRuntime struct {
	loadEnv       func(path string) error
	initResources func() error
	closeDB       func() error
	createUser    func(username, password, displayName string, role int) (*model.User, error)
	setRole       func(username string, role int) (int, *model.User, error)
	afterSetRole  func(user *model.User, previousRole int, stderr io.Writer) error
	resetPassword func(username, password string) error
	afterReset    func(username string, stderr io.Writer) error
	lookupEnv     func(key string) (string, bool)
	stdin         io.Reader
	isTerminal    func() bool
	readPassword  func(prompt string) (string, error)
}

func RunUser(args []string, stdout, stderr io.Writer) int {
	return runUser(args, stdout, stderr, defaultUserCommandRuntime(stderr))
}

func defaultUserCommandRuntime(stderr io.Writer) userCommandRuntime {
	resetRuntime := defaultResetPasswordRuntime(stderr)
	return userCommandRuntime{
		loadEnv:       resetRuntime.loadEnv,
		initResources: initUserCLIResources,
		closeDB:       resetRuntime.closeDB,
		createUser:    model.CreateAccount,
		setRole:       model.SetUserRoleByUsername,
		afterSetRole:  clearDemotedAdminAuthorization,
		resetPassword: resetRuntime.resetPassword,
		afterReset:    resetRuntime.afterReset,
		lookupEnv:     resetRuntime.lookupEnv,
		stdin:         resetRuntime.stdin,
		isTerminal:    resetRuntime.isTerminal,
		readPassword:  resetRuntime.readPassword,
	}
}

func runUser(args []string, stdout, stderr io.Writer, runtime userCommandRuntime) int {
	if len(args) == 0 {
		printUserUsage(stderr)
		return 2
	}
	command, rest := args[0], args[1:]
	switch command {
	case "create":
		return runUserCreate(rest, stdout, stderr, runtime)
	case "set-role":
		return runUserSetRole(rest, stdout, stderr, runtime)
	case "set-password", "reset-password":
		return runResetPassword(rest, stdout, stderr, resetPasswordRuntime{
			loadEnv:       runtime.loadEnv,
			initResources: runtime.initResources,
			closeDB:       runtime.closeDB,
			resetPassword: runtime.resetPassword,
			afterReset:    runtime.afterReset,
			lookupEnv:     runtime.lookupEnv,
			stdin:         runtime.stdin,
			isTerminal:    runtime.isTerminal,
			readPassword:  runtime.readPassword,
		})
	case "-h", "-help", "--help":
		printUserUsage(stderr)
		return 0
	default:
		fmt.Fprintf(stderr, "unknown user command %q\n", command)
		printUserUsage(stderr)
		return 2
	}
}

func printUserUsage(stderr io.Writer) {
	fmt.Fprintln(stderr, "usage: new-api user create --username <name> --role user|admin [flags]")
	fmt.Fprintln(stderr, "       new-api user set-role --username <name> --role user|admin [flags]")
	fmt.Fprintln(stderr, "       new-api user set-password [--username <name>] [flags]")
}

func runUserCreate(args []string, stdout, stderr io.Writer, runtime userCommandRuntime) int {
	options, err := parseUserCreateArgs(args, stderr)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	password, err := resolveCreatePassword(options, runtime)
	if err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	if err := common.ValidateNewAccountPassword(password); err != nil {
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	if err := withUserCLIResources(options.envFile, runtime, stderr, func() error {
		user, err := runtime.createUser(options.username, password, options.displayName, options.role)
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "created user %q with role %s (id %d)\n", user.Username, options.roleName, user.Id)
		return nil
	}); err != nil {
		fmt.Fprintf(stderr, "create user: %v\n", err)
		return 1
	}
	return 0
}

func runUserSetRole(args []string, stdout, stderr io.Writer, runtime userCommandRuntime) int {
	options, err := parseUserSetRoleArgs(args, stderr)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		fmt.Fprintln(stderr, err.Error())
		return 2
	}
	if err := withUserCLIResources(options.envFile, runtime, stderr, func() error {
		previousRole, user, err := runtime.setRole(options.username, options.role)
		if err != nil {
			return err
		}
		if runtime.afterSetRole != nil {
			if err := runtime.afterSetRole(user, previousRole, stderr); err != nil {
				fmt.Fprintf(stderr, "warning: %v\n", err)
			}
		}
		if previousRole == options.role {
			fmt.Fprintf(stdout, "user %q already has role %s\n", user.Username, options.roleName)
			return nil
		}
		fmt.Fprintf(stdout, "updated user %q role to %s; existing sessions were revoked\n", user.Username, options.roleName)
		return nil
	}); err != nil {
		fmt.Fprintf(stderr, "set role: %v\n", err)
		return 1
	}
	return 0
}

func parseUserCreateArgs(args []string, stderr io.Writer) (userCreateOptions, error) {
	flags := flag.NewFlagSet("user create", flag.ContinueOnError)
	flags.SetOutput(stderr)
	flags.Usage = func() {
		fmt.Fprintln(stderr, "usage: new-api user create --username <name> --role user|admin [flags]")
		fmt.Fprintln(stderr, "")
		fmt.Fprintln(stderr, "Create an enabled account. Role root is not allowed.")
		fmt.Fprintln(stderr, "Provide the password with --password-stdin, NEW_API_USER_PASSWORD,")
		fmt.Fprintln(stderr, "--password, or an interactive prompt.")
		fmt.Fprintln(stderr, "")
		flags.PrintDefaults()
	}
	username := flags.String("username", "", "account username")
	displayName := flags.String("display-name", "", "display name; defaults to username")
	roleName := flags.String("role", roleUser, "account role: user or admin")
	envFile := flags.String("env-file", defaultEnvFile, "env file to load; set empty to skip")
	password := flags.String("password", "", "password (visible in process lists)")
	passwordStdin := flags.Bool("password-stdin", false, "read the password from stdin")
	if err := flags.Parse(args); err != nil {
		return userCreateOptions{}, err
	}
	if flags.NArg() != 0 {
		return userCreateOptions{}, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	role, err := parseAccountRole(*roleName)
	if err != nil {
		return userCreateOptions{}, err
	}
	options := userCreateOptions{
		username:      strings.TrimSpace(*username),
		displayName:   strings.TrimSpace(*displayName),
		role:          role,
		roleName:      accountRoleName(role),
		envFile:       *envFile,
		password:      *password,
		passwordStdin: *passwordStdin,
	}
	if options.username == "" {
		return userCreateOptions{}, errors.New("username is required")
	}
	return options, nil
}

func parseUserSetRoleArgs(args []string, stderr io.Writer) (userSetRoleOptions, error) {
	flags := flag.NewFlagSet("user set-role", flag.ContinueOnError)
	flags.SetOutput(stderr)
	flags.Usage = func() {
		fmt.Fprintln(stderr, "usage: new-api user set-role --username <name> --role user|admin [flags]")
		fmt.Fprintln(stderr, "")
		fmt.Fprintln(stderr, "Change an account role. The root account cannot be changed,")
		fmt.Fprintln(stderr, "and role root cannot be assigned.")
		fmt.Fprintln(stderr, "")
		flags.PrintDefaults()
	}
	username := flags.String("username", "", "account username")
	roleName := flags.String("role", "", "account role: user or admin")
	envFile := flags.String("env-file", defaultEnvFile, "env file to load; set empty to skip")
	if err := flags.Parse(args); err != nil {
		return userSetRoleOptions{}, err
	}
	if flags.NArg() != 0 {
		return userSetRoleOptions{}, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	if strings.TrimSpace(*username) == "" {
		return userSetRoleOptions{}, errors.New("username is required")
	}
	if strings.TrimSpace(*roleName) == "" {
		return userSetRoleOptions{}, errors.New("role is required")
	}
	role, err := parseAccountRole(*roleName)
	if err != nil {
		return userSetRoleOptions{}, err
	}
	return userSetRoleOptions{
		username: strings.TrimSpace(*username),
		role:     role,
		roleName: accountRoleName(role),
		envFile:  *envFile,
	}, nil
}

func parseAccountRole(value string) (int, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case roleUser, "common", "1":
		return common.RoleCommonUser, nil
	case roleAdmin, "10":
		return common.RoleAdminUser, nil
	case "root", "100":
		return 0, errors.New("role root cannot be assigned from the CLI")
	default:
		return 0, fmt.Errorf("unknown role %q; use user or admin", value)
	}
}

func accountRoleName(role int) string {
	if role == common.RoleAdminUser {
		return roleAdmin
	}
	return roleUser
}

func resolveCreatePassword(options userCreateOptions, runtime userCommandRuntime) (string, error) {
	return resolveResetPassword(resetPasswordOptions{
		password:      options.password,
		passwordStdin: options.passwordStdin,
	}, resetPasswordRuntime{
		passwordEnv:  createPasswordEnvName,
		lookupEnv:    runtime.lookupEnv,
		stdin:        runtime.stdin,
		isTerminal:   runtime.isTerminal,
		readPassword: runtime.readPassword,
	})
}

func withUserCLIResources(envFile string, runtime userCommandRuntime, stderr io.Writer, action func() error) error {
	if err := runtime.loadEnv(envFile); err != nil {
		return fmt.Errorf("load env file: %w", err)
	}
	if err := runtime.initResources(); err != nil {
		return fmt.Errorf("initialize database: %w", err)
	}
	defer func() {
		if runtime.closeDB == nil {
			return
		}
		if closeErr := runtime.closeDB(); closeErr != nil {
			fmt.Fprintf(stderr, "close database: %v\n", closeErr)
		}
	}()
	return action()
}

func clearDemotedAdminAuthorization(user *model.User, previousRole int, stderr io.Writer) error {
	if user == nil || previousRole < common.RoleAdminUser || user.Role >= common.RoleAdminUser {
		return nil
	}
	if err := authz.Init(model.DB); err != nil {
		return err
	}
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		return authz.ClearUserAuthorizationInTx(tx, user.Id)
	}); err != nil {
		return err
	}
	if err := authz.ReloadPolicy(); err != nil {
		fmt.Fprintf(stderr, "warning: %v\n", err)
	}
	return nil
}

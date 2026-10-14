package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type scopedUser struct {
	ID       int
	Username string
}

// resolveScopedUser reads an optional user_id query. The signed-in user can
// read their own records. An administrator can read another existing user.
func resolveScopedUser(c *gin.Context) (scopedUser, bool) {
	self := scopedUser{
		ID:       c.GetInt("id"),
		Username: c.GetString("username"),
	}
	raw := strings.TrimSpace(c.Query("user_id"))
	if raw == "" {
		return self, true
	}
	userID, err := strconv.Atoi(raw)
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "invalid user id")
		return scopedUser{}, false
	}
	if userID == self.ID {
		return self, true
	}
	if c.GetInt("role") < common.RoleAdminUser {
		common.ApiErrorMsg(c, "access denied")
		return scopedUser{}, false
	}
	user, err := model.GetUserById(userID, false)
	if err != nil || user == nil || user.Id != userID || user.Username == "" {
		common.ApiErrorMsg(c, "user not found")
		return scopedUser{}, false
	}
	return scopedUser{ID: user.Id, Username: user.Username}, true
}

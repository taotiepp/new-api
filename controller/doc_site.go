/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"errors"
	"io/fs"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service/docsite"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func GetDocSiteTree(c *gin.Context) {
	tree, err := docsite.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "文档读取失败",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tree,
	})
}

func GetDocSitePage(c *gin.Context) {
	page, err := docsite.Read(c.Param("path"), docSiteAddress(c))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "文档不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "文档读取失败",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    page,
	})
}

func docSiteAddress(c *gin.Context) string {
	proto := ""
	if c.Request != nil && c.Request.TLS != nil {
		proto = "https"
	}
	forwarded, _, _ := strings.Cut(c.GetHeader("X-Forwarded-Proto"), ",")
	forwarded = strings.ToLower(strings.TrimSpace(forwarded))
	if forwarded == "https" || forwarded == "http" {
		proto = forwarded
	}
	host := ""
	if c.Request != nil {
		host = c.Request.Host
	}
	return docsite.ResolveSiteAddress(system_setting.ServerAddress, host, proto)
}

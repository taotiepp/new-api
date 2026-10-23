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
package docsite

import (
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListOrdersFoldersAndPages(t *testing.T) {
	tree, err := listFrom(sampleFS(), ".")
	require.NoError(t, err)
	require.Len(t, tree, 1)
	assert.Equal(t, "API", tree[0].Title)
	assert.Equal(t, "api", tree[0].Path)
	require.Len(t, tree[0].Children, 2)
	assert.Equal(t, "Later", tree[0].Children[0].Title)
	assert.Equal(t, []string{"API calls", "SDK calls"}, []string{
		tree[0].Children[0].Children[0].Title,
		tree[0].Children[0].Children[1].Title,
	})
	assert.Equal(t, "Earlier", tree[0].Children[1].Title)
}

func TestReadReplacesServerAddress(t *testing.T) {
	page, err := readFrom(sampleFS(), ".", "api/later/http", "https://gateway.example/")
	require.NoError(t, err)
	assert.Equal(t, "api/later/http", page.Path)
	assert.Equal(t, "API calls", page.Title)
	assert.Contains(t, page.Content, "https://gateway.example/v1/chat/completions")
	assert.NotContains(t, page.Content, serverAddressToken)
	assert.NotContains(t, page.Content, "title:")
}

func TestReadRejectsPathsOutsideTheDocsTree(t *testing.T) {
	for _, docPath := range []string{"", "../secret", "api/../../secret", `api\openai`, "api/_index", "missing/page"} {
		_, err := readFrom(sampleFS(), ".", docPath, "https://gateway.example")
		assert.ErrorIs(t, err, fs.ErrNotExist, docPath)
	}
}

func TestResolveSiteAddress(t *testing.T) {
	assert.Equal(t, "https://api.example.com", ResolveSiteAddress("https://api.example.com/", "ignored.example", "http"))
	assert.Equal(t, "https://visited.example", ResolveSiteAddress("http://localhost:3000", "visited.example", "https"))
	assert.Equal(t, "http://localhost:3000", ResolveSiteAddress("", "", ""))
	assert.Equal(t, "http://localhost:8080", ResolveSiteAddress("http://localhost:8080", "visited.example", "https"))
}

func TestEmbeddedAPIDocsUseTheSiteAddress(t *testing.T) {
	tree, err := List()
	require.NoError(t, err)
	require.NotEmpty(t, tree)
	titles := map[string]string{}
	var walk func([]Node)
	walk = func(nodes []Node) {
		for _, node := range nodes {
			if node.Path != "" {
				titles[node.Path] = node.Title
			}
			walk(node.Children)
		}
	}
	walk(tree)
	for _, item := range []struct{ path, title string }{
		{"api", "API访问说明"},
		{"api/openai", "OpenAI协议"},
		{"api/claude", "Claude协议"},
		{"api/gemini", "Gemini协议"},
		{"model-calling", "模型调用"},
		{"virtual-groups", "虚拟分组"},
	} {
		assert.Equal(t, item.title, titles[item.path], item.path)
	}

	address := "https://gateway.example"
	pages := []struct {
		path    string
		snippet string
		absent  string
	}{
		{"api/openai/http", address + "/v1/chat/completions", ""},
		{"api/openai/sdk", `base_url="` + address + `/v1"`, ""},
		{"api/claude/http", address + "/v1/messages", ""},
		{"api/claude/sdk", `base_url="` + address + `"`, address + "/v1"},
		{"api/gemini/http", address + "/v1beta/models/gemini-2.5-flash:generateContent", ""},
		{"api/gemini/sdk", `base_url="` + address + `"`, address + "/v1"},
	}
	for _, page := range pages {
		got, err := Read(page.path, address)
		require.NoError(t, err, page.path)
		assert.Contains(t, got.Content, page.snippet, page.path)
		assert.NotContains(t, got.Content, serverAddressToken, page.path)
		if page.absent != "" {
			assert.NotContains(t, got.Content, page.absent, page.path)
		}
	}
}

func sampleFS() fs.FS {
	return fstest.MapFS{
		"api/index.md":         &fstest.MapFile{Data: []byte("---\ntitle: API\norder: 1\n---\n# API\n")},
		"api/earlier/index.md": &fstest.MapFile{Data: []byte("---\ntitle: Earlier\norder: 2\n---\n# Earlier\n")},
		"api/later/index.md":   &fstest.MapFile{Data: []byte("---\ntitle: Later\norder: 1\n---\n# Later\n")},
		"api/later/http.md":    &fstest.MapFile{Data: []byte("---\ntitle: API calls\norder: 1\n---\n# API calls\n\nPOST {{server_address}}/v1/chat/completions\n")},
		"api/later/sdk.md":     &fstest.MapFile{Data: []byte("---\ntitle: SDK calls\norder: 2\n---\n# SDK calls\n")},
		"notes.txt":            &fstest.MapFile{Data: []byte("ignore")},
	}
}

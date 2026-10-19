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
	"cmp"
	"embed"
	"errors"
	"io/fs"
	"path"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"
)

// Pages live in content/. A directory is a menu group; _index.md is that
// group's page, and every other .md file is a page. {{server_address}} in the
// body is replaced when the page is read.

//go:embed content
var contentFS embed.FS

const contentRoot = "content"
const serverAddressToken = "{{server_address}}"
const defaultSiteAddress = "http://localhost:3000"

type Node struct {
	Title    string `json:"title"`
	Path     string `json:"path"`
	Children []Node `json:"children,omitempty"`
}

type Page struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type pageMeta struct {
	Title string `yaml:"title"`
	Order int    `yaml:"order"`
}

type orderedNode struct {
	order int
	node  Node
}

func List() ([]Node, error) {
	return listFrom(contentFS, contentRoot)
}

func Read(docPath, serverAddress string) (Page, error) {
	return readFrom(contentFS, contentRoot, docPath, serverAddress)
}

// ResolveSiteAddress prefers an explicitly configured public address. The
// built-in localhost default is only a placeholder, so a request that arrived
// on another host uses that host instead.
func ResolveSiteAddress(configured, host, proto string) string {
	configured = strings.TrimRight(strings.TrimSpace(configured), "/")
	if configured != "" && configured != defaultSiteAddress {
		return configured
	}
	host = strings.TrimSpace(host)
	if host == "" {
		if configured != "" {
			return configured
		}
		return defaultSiteAddress
	}
	scheme := "http"
	if strings.EqualFold(strings.TrimSpace(proto), "https") {
		scheme = "https"
	}
	return scheme + "://" + host
}

func listFrom(fsys fs.FS, root string) ([]Node, error) {
	return readLevel(fsys, root, "")
}

func readFrom(fsys fs.FS, root, docPath, serverAddress string) (Page, error) {
	rel, ok := cleanDocPath(docPath)
	if !ok {
		return Page{}, fs.ErrNotExist
	}
	filePath := path.Join(root, rel+".md")
	data, err := fs.ReadFile(fsys, filePath)
	if errors.Is(err, fs.ErrNotExist) {
		filePath = path.Join(root, rel, "_index.md")
		data, err = fs.ReadFile(fsys, filePath)
	}
	if err != nil {
		return Page{}, err
	}
	if !docFileWithinRoot(root, filePath) {
		return Page{}, fs.ErrNotExist
	}
	meta, body, err := parseMarkdown(data)
	if err != nil {
		return Page{}, err
	}
	title := pageTitle(meta, body, path.Base(rel))
	body = strings.ReplaceAll(body, serverAddressToken, strings.TrimRight(serverAddress, "/"))
	return Page{
		Path:    rel,
		Title:   title,
		Content: strings.TrimSpace(body),
	}, nil
}

func readLevel(fsys fs.FS, dir, publicPath string) ([]Node, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, err
	}
	items := make([]orderedNode, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if name == "" || strings.HasPrefix(name, ".") {
			continue
		}
		full := path.Join(dir, name)
		if entry.IsDir() {
			childPublic := name
			if publicPath != "" {
				childPublic = path.Join(publicPath, name)
			}
			children, err := readLevel(fsys, full, childPublic)
			if err != nil {
				return nil, err
			}
			meta, body, found, err := readOptional(fsys, path.Join(full, "_index.md"))
			if err != nil {
				return nil, err
			}
			if !found && len(children) == 0 {
				continue
			}
			title := name
			order := 0
			pagePath := ""
			if found {
				title = pageTitle(meta, body, name)
				order = meta.Order
				pagePath = childPublic
			}
			items = append(items, orderedNode{
				order: order,
				node: Node{
					Title:    title,
					Path:     pagePath,
					Children: children,
				},
			})
			continue
		}
		if !strings.HasSuffix(name, ".md") || name == "_index.md" || strings.HasPrefix(name, "_") {
			continue
		}
		meta, body, err := readMarkdownFile(fsys, full)
		if err != nil {
			return nil, err
		}
		stem := strings.TrimSuffix(name, ".md")
		pagePath := stem
		if publicPath != "" {
			pagePath = path.Join(publicPath, stem)
		}
		items = append(items, orderedNode{
			order: meta.Order,
			node: Node{
				Title: pageTitle(meta, body, stem),
				Path:  pagePath,
			},
		})
	}
	slices.SortFunc(items, func(a, b orderedNode) int {
		return cmp.Or(cmp.Compare(a.order, b.order), strings.Compare(a.node.Title, b.node.Title))
	})
	nodes := make([]Node, len(items))
	for i, item := range items {
		nodes[i] = item.node
	}
	return nodes, nil
}

func readOptional(fsys fs.FS, filePath string) (pageMeta, string, bool, error) {
	data, err := fs.ReadFile(fsys, filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return pageMeta{}, "", false, nil
	}
	if err != nil {
		return pageMeta{}, "", false, err
	}
	meta, body, err := parseMarkdown(data)
	if err != nil {
		return pageMeta{}, "", false, err
	}
	return meta, body, true, nil
}

func readMarkdownFile(fsys fs.FS, filePath string) (pageMeta, string, error) {
	data, err := fs.ReadFile(fsys, filePath)
	if err != nil {
		return pageMeta{}, "", err
	}
	return parseMarkdown(data)
}

func parseMarkdown(data []byte) (pageMeta, string, error) {
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return pageMeta{}, text, nil
	}
	rest := strings.TrimPrefix(text, "---\n")
	front, body, ok := strings.Cut(rest, "\n---\n")
	if !ok {
		return pageMeta{}, "", errors.New("docsite: unclosed frontmatter")
	}
	var meta pageMeta
	if err := yaml.Unmarshal([]byte(front), &meta); err != nil {
		return pageMeta{}, "", err
	}
	return meta, body, nil
}

func pageTitle(meta pageMeta, body, fallback string) string {
	if title := strings.TrimSpace(meta.Title); title != "" {
		return title
	}
	for line := range strings.Lines(body) {
		heading, ok := strings.CutPrefix(strings.TrimSpace(line), "# ")
		if ok && heading != "" {
			return heading
		}
	}
	return fallback
}

func docFileWithinRoot(root, filePath string) bool {
	cleanedRoot := path.Clean(root)
	cleanedFile := path.Clean(filePath)
	if cleanedRoot == "." {
		return cleanedFile != ".." && !strings.HasPrefix(cleanedFile, "../")
	}
	return cleanedFile == cleanedRoot || strings.HasPrefix(cleanedFile, cleanedRoot+"/")
}

func cleanDocPath(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	raw = strings.Trim(raw, "/")
	if raw == "" || strings.Contains(raw, "\\") || strings.Contains(raw, "\x00") {
		return "", false
	}
	cleaned := path.Clean(raw)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || path.IsAbs(cleaned) {
		return "", false
	}
	for segment := range strings.SplitSeq(cleaned, "/") {
		if segment == "" || segment == "." || segment == ".." || strings.HasPrefix(segment, "_") || strings.HasPrefix(segment, ".") {
			return "", false
		}
	}
	return cleaned, true
}

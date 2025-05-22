package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type FileInfo struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	Type     string     `json:"type"`
	ProjectID string    `json:"projectId"`
	Children []FileInfo `json:"children,omitempty"`
}

var projects = make(map[string]Project)

func main() {
	// Create projects directory if it doesn't exist
	if err := os.MkdirAll("projects", 0755); err != nil {
		log.Fatal(err)
	}

	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173"}
	r.Use(cors.New(config))

	// Project routes
	r.POST("/api/projects", createProject)
	r.GET("/api/projects", listProjects)
	r.GET("/api/projects/:id", getProject)
	r.DELETE("/api/projects/:id", deleteProject)

	// File system routes
	r.GET("/api/files", listFiles)
	r.GET("/api/files/content", getFileContent)
	r.POST("/api/files/upload", uploadFile)

	// Start server
	log.Fatal(r.Run(":8080"))
}

func createProject(c *gin.Context) {
	var project Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project.ID = time.Now().Format("20060102150405")
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	// Create project directory
	projectPath := filepath.Join("projects", project.ID)
	if err := os.MkdirAll(projectPath, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	projects[project.ID] = project
	c.JSON(http.StatusCreated, project)
}

func listProjects(c *gin.Context) {
	projectList := make([]Project, 0, len(projects))
	for _, project := range projects {
		projectList = append(projectList, project)
	}
	c.JSON(http.StatusOK, projectList)
}

func getProject(c *gin.Context) {
	id := c.Param("id")
	project, exists := projects[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

func deleteProject(c *gin.Context) {
	id := c.Param("id")
	if _, exists := projects[id]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	// Delete project directory and all its contents
	projectPath := filepath.Join("projects", id)
	if err := os.RemoveAll(projectPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	delete(projects, id)
	c.JSON(http.StatusOK, gin.H{"message": "project deleted successfully"})
}

func listFiles(c *gin.Context) {
	projectID := c.Query("projectId")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "projectId is required"})
		return
	}

	root := filepath.Join("projects", projectID)
	if _, err := os.Stat(root); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "project directory not found"})
		return
	}

	var files []FileInfo
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		fileType := "file"
		if info.IsDir() {
			if path == root {
				return nil
			}
			fileType = "folder"
		} else {
			ext := filepath.Ext(path)
			switch ext {
			case ".pdf":
				fileType = "pdf"
			case ".txt":
				fileType = "txt"
			case ".csv":
				fileType = "csv"
			}
		}

		relPath, _ := filepath.Rel(root, path)
		files = append(files, FileInfo{
			Name:      info.Name(),
			Path:      relPath,
			Type:      fileType,
			ProjectID: projectID,
		})
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, files)
}

func getFileContent(c *gin.Context) {
	projectID := c.Query("projectId")
	path := c.Query("path")
	if projectID == "" || path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "projectId and path are required"})
		return
	}

	fullPath := filepath.Join("projects", projectID, path)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", content)
}

func uploadFile(c *gin.Context) {
	projectID := c.PostForm("projectId")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "projectId is required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Save the file in the project directory
	uploadPath := filepath.Join("projects", projectID, file.Filename)
	if err := c.SaveUploadedFile(file, uploadPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file uploaded successfully"})
} 
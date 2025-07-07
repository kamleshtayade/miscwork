// 1. Install required dependencies
// npm install axios

// 2. GitLab Configuration for AKS deployment
// src/config/gitlabConfig.js
export const gitlabConfig = {
  // Use environment variables for configuration
  baseURL: process.env.REACT_APP_GITLAB_URL || 'https://gitlab.com/api/v4',
  timeout: 30000,
  retries: 3,
};

// 3. GitLab API Service with AKS optimizations
// src/services/gitlabService.js
import axios from 'axios';
import { gitlabConfig } from '../config/gitlabConfig';

class GitLabService {
  constructor() {
    this.baseURL = gitlabConfig.baseURL;
    this.timeout = gitlabConfig.timeout;
    this.retries = gitlabConfig.retries;
    
    // Initialize axios instance with retry logic
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and retries
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401) {
          console.error('GitLab authentication failed - check your personal access token');
          throw new Error('GitLab authentication failed');
        }
        
        // Retry logic for network errors
        if (!originalRequest._retry && this.shouldRetry(error)) {
          originalRequest._retry = true;
          await this.delay(1000);
          return this.api(originalRequest);
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Get token from various sources (environment, secrets, etc.)
  getToken() {
    // Priority order: Runtime environment variable, build-time env var, secret mount
    return (
      process.env.GITLAB_TOKEN || 
      process.env.REACT_APP_GITLAB_TOKEN ||
      this.getTokenFromSecret()
    );
  }

  // Read token from Kubernetes secret mount (if available)
  getTokenFromSecret() {
    try {
      // In AKS, secrets are typically mounted at /etc/secrets/
      const fs = require('fs');
      return fs.readFileSync('/etc/secrets/gitlab-token', 'utf8').trim();
    } catch (error) {
      console.warn('Could not read GitLab token from secret mount');
      return null;
    }
  }

  shouldRetry(error) {
    return (
      !error.response || 
      error.response.status >= 500 || 
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND'
    );
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check for GitLab connectivity
  async healthCheck() {
    try {
      const response = await this.api.get('/version');
      return { status: 'healthy', version: response.data.version };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Get current user info from GitLab
  async getCurrentUser() {
    try {
      const response = await this.api.get('/user');
      return response.data;
    } catch (error) {
      console.error('Error fetching GitLab user:', error);
      throw new Error(`Failed to fetch GitLab user: ${error.message}`);
    }
  }

  // Get user's projects with pagination
  async getUserProjects(page = 1, perPage = 20) {
    try {
      const response = await this.api.get('/projects', {
        params: {
          membership: true,
          page,
          per_page: perPage,
          order_by: 'last_activity_at',
          sort: 'desc'
        }
      });
      return {
        projects: response.data,
        totalPages: parseInt(response.headers['x-total-pages']) || 1,
        totalItems: parseInt(response.headers['x-total']) || 0
      };
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  // Get project details
  async getProject(projectId) {
    try {
      const response = await this.api.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project:', error);
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
  }

  // Get project commits with pagination
  async getProjectCommits(projectId, branch = 'main', page = 1, perPage = 20) {
    try {
      const response = await this.api.get(`/projects/${projectId}/repository/commits`, {
        params: {
          ref_name: branch,
          page,
          per_page: perPage
        }
      });
      return {
        commits: response.data,
        totalPages: parseInt(response.headers['x-total-pages']) || 1,
        totalItems: parseInt(response.headers['x-total']) || 0
      };
    } catch (error) {
      console.error('Error fetching commits:', error);
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  // Get project branches
  async getProjectBranches(projectId) {
    try {
      const response = await this.api.get(`/projects/${projectId}/repository/branches`);
      return response.data;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  // Get project merge requests
  async getProjectMergeRequests(projectId, state = 'opened') {
    try {
      const response = await this.api.get(`/projects/${projectId}/merge_requests`, {
        params: { state }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching merge requests:', error);
      throw new Error(`Failed to fetch merge requests: ${error.message}`);
    }
  }

  // Get project issues
  async getProjectIssues(projectId, state = 'opened') {
    try {
      const response = await this.api.get(`/projects/${projectId}/issues`, {
        params: { state }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }
  }
}

export default new GitLabService();

// 4. React Hook for GitLab operations
// src/hooks/useGitLab.js
import { useState, useCallback, useEffect } from 'react';
import GitLabService from '../services/gitlabService';

export const useGitLab = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gitlabHealth, setGitlabHealth] = useState(null);

  // Check GitLab connectivity on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const health = await GitLabService.healthCheck();
      setGitlabHealth(health);
    } catch (err) {
      setGitlabHealth({ status: 'unhealthy', error: err.message });
    }
  }, []);

  const executeGitLabOperation = useCallback(async (operation) => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      console.error('GitLab operation failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUser = useCallback(() => 
    executeGitLabOperation(() => GitLabService.getCurrentUser()), 
    [executeGitLabOperation]
  );

  const getProjects = useCallback((page = 1, perPage = 20) => 
    executeGitLabOperation(() => GitLabService.getUserProjects(page, perPage)), 
    [executeGitLabOperation]
  );

  const getProject = useCallback((projectId) => 
    executeGitLabOperation(() => GitLabService.getProject(projectId)), 
    [executeGitLabOperation]
  );

  const getCommits = useCallback((projectId, branch = 'main', page = 1, perPage = 20) => 
    executeGitLabOperation(() => GitLabService.getProjectCommits(projectId, branch, page, perPage)), 
    [executeGitLabOperation]
  );

  const getBranches = useCallback((projectId) => 
    executeGitLabOperation(() => GitLabService.getProjectBranches(projectId)), 
    [executeGitLabOperation]
  );

  const getMergeRequests = useCallback((projectId, state = 'opened') => 
    executeGitLabOperation(() => GitLabService.getProjectMergeRequests(projectId, state)), 
    [executeGitLabOperation]
  );

  const getIssues = useCallback((projectId, state = 'opened') => 
    executeGitLabOperation(() => GitLabService.getProjectIssues(projectId, state)), 
    [executeGitLabOperation]
  );

  return {
    loading,
    error,
    gitlabHealth,
    checkHealth,
    getUser,
    getProjects,
    getProject,
    getCommits,
    getBranches,
    getMergeRequests,
    getIssues,
  };
};

// 5. Main App Component (assumes AAD authentication is already handled)
// src/App.js
import React, { useState, useEffect } from 'react';
import { useGitLab } from './hooks/useGitLab';

const App = () => {
  const { 
    loading, 
    error, 
    gitlabHealth, 
    getUser, 
    getProjects 
  } = useGitLab();

  const [gitlabUser, setGitlabUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Assume AAD user is available from your existing authentication
    // This would typically come from your AAD context/provider
    const aadUser = {
      name: 'John Doe', // This would come from your AAD implementation
      email: 'john.doe@company.com'
    };
    setCurrentUser(aadUser);
    
    // Fetch GitLab data
    fetchGitLabData();
  }, []);

  const fetchGitLabData = async () => {
    try {
      // Fetch GitLab user info
      const user = await getUser();
      setGitlabUser(user);

      // Fetch user's projects
      const projectsData = await getProjects(1, 10);
      setProjects(projectsData.projects);
      
    } catch (err) {
      console.error('Failed to fetch GitLab data:', err);
    }
  };

  const getHealthStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'green';
      case 'unhealthy': return 'red';
      default: return 'orange';
    }
  };

  if (loading && !gitlabUser) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading GitLab data...</h2>
        <p>Connecting to GitLab API...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Connection Status */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '10px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '5px' 
      }}>
        <h3>GitLab Connection Status</h3>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <span style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            backgroundColor: getHealthStatusColor(gitlabHealth?.status) 
          }}></span>
          <span>{gitlabHealth?.status || 'checking...'}</span>
          {gitlabHealth?.version && (
            <span>| Version: {gitlabHealth.version}</span>
          )}
        </div>
      </div>

      {/* User Information */}
      <div style={{ 
        marginBottom: '20px', 
        borderBottom: '1px solid #ccc', 
        paddingBottom: '10px' 
      }}>
        <h2>User Information</h2>
        {currentUser && (
          <div style={{ marginBottom: '10px' }}>
            <h4>Azure AD User:</h4>
            <p><strong>Name:</strong> {currentUser.name}</p>
            <p><strong>Email:</strong> {currentUser.email}</p>
          </div>
        )}
        
        {gitlabUser && (
          <div>
            <h4>GitLab User:</h4>
            <p><strong>Name:</strong> {gitlabUser.name}</p>
            <p><strong>Username:</strong> {gitlabUser.username}</p>
            <p><strong>Email:</strong> {gitlabUser.email}</p>
            <p><strong>GitLab ID:</strong> {gitlabUser.id}</p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          borderRadius: '5px',
          color: 'red'
        }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={fetchGitLabData}
            style={{ marginLeft: '10px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Projects List */}
      <div>
        <h3>Your GitLab Projects</h3>
        {projects.length > 0 ? (
          <div style={{ display: 'grid', gap: '15px' }}>
            {projects.map(project => (
              <div key={project.id} style={{ 
                padding: '15px', 
                border: '1px solid #ddd', 
                borderRadius: '5px',
                backgroundColor: '#fafafa'
              }}>
                <h4>{project.name}</h4>
                <p>{project.description || 'No description'}</p>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                  <span style={{ marginLeft: '20px' }}>
                    Last Activity: {new Date(project.last_activity_at).toLocaleDateString()}
                  </span>
                  <span style={{ marginLeft: '20px' }}>
                    Stars: {project.star_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No projects found.</p>
        )}
      </div>
    </div>
  );
};

export default App;

// 6. Kubernetes ConfigMap for GitLab configuration (gitlab-config.yaml)
/*
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitlab-config
  namespace: your-namespace
data:
  REACT_APP_GITLAB_URL: "https://gitlab.com/api/v4"
  GITLAB_TIMEOUT: "30000"
---
apiVersion: v1
kind: Secret
metadata:
  name: gitlab-secrets
  namespace: your-namespace
type: Opaque
data:
  gitlab-token: <base64-encoded-gitlab-token>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-app
  namespace: your-namespace
spec:
  replicas: 3
  selector:
    matchLabels:
      app: react-app
  template:
    metadata:
      labels:
        app: react-app
    spec:
      containers:
      - name: react-app
        image: your-registry/react-app:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: gitlab-config
        volumeMounts:
        - name: gitlab-secrets
          mountPath: /etc/secrets
          readOnly: true
      volumes:
      - name: gitlab-secrets
        secret:
          secretName: gitlab-secrets
*/

// 7. Dockerfile for AKS deployment
/*
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
*/

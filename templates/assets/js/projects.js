/**
 * MatesUp Projects Page Scripts
 * This script handles all functionality for the projects page:
 * - Fetching projects from the API
 * - Displaying projects in appropriate sections
 * - Search functionality
 * - Category filtering
 * - Project creation
 * - Project details viewing
 * - Connection requests
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get logged in state from body data attribute
    const isLoggedIn = document.body.getAttribute('data-is-logged-in') === 'true';
    const username = document.body.getAttribute('data-username');
    
    // Project data store
    let projectsData = {
        myProjects: [],
        otherProjects: []
    };

    // Connection requests data store
    let connectionRequests = [];
    
    // Initialize the page
    initProjectsPage();
    
    /**
     * Initialize the projects page
     */
    function initProjectsPage() {
        // Fetch projects from API
        fetchProjects();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show appropriate sections based on login state
        if (isLoggedIn) {
            document.getElementById('myProjectsSection').style.display = 'block';
            document.getElementById('otherProjectsTitle').textContent = 'Recommended Projects';
            // Fetch connection requests if logged in
            fetchConnectionRequests();
        } else {
            document.getElementById('myProjectsSection').style.display = 'none';
            document.getElementById('otherProjectsTitle').textContent = 'All Projects';
        }
    }
    
    /**
     * Set up all event listeners for the page
     */
    function setupEventListeners() {
        // Search inputs
        document.getElementById('myProjectSearch').addEventListener('input', function() {
            filterProjects('myProjects', this.value);
        });
        
        document.getElementById('otherProjectSearch').addEventListener('input', function() {
            filterProjects('otherProjects', this.value);
        });
        
        // Category filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                // Filter projects by category
                filterProjectsByCategory(this.getAttribute('data-filter'));
            });
        });
        
        // Create project form
        if (isLoggedIn) {
            document.getElementById('saveProjectBtn').addEventListener('click', createProject);
        } else {
            // If not logged in, redirect to login when trying to create project
            document.querySelector('.btn-create-project').addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = '/login';
            });
        }
    }
    
    /**
     * Fetch projects from the API
     */
    function fetchProjects() {
        fetch('/api/projects')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Store projects data
                projectsData = data;
                
                // Render projects
                renderProjects('myProjects', data.myProjects);
                renderProjects('otherProjects', data.otherProjects);
            })
            .catch(error => {
                console.error('Error fetching projects:', error);
                document.getElementById('loadingMyProjects').innerHTML = 
                    '<div class="alert alert-danger">Failed to load projects. Please try again later.</div>';
                document.getElementById('loadingOtherProjects').innerHTML = 
                    '<div class="alert alert-danger">Failed to load projects. Please try again later.</div>';
            });
    }

    /**
     * Fetch connection requests for the current user
     */
    function fetchConnectionRequests() {
        if (!isLoggedIn) return;

        fetch('/api/connection-requests')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    connectionRequests = data.requests;
                    // Update connection buttons state based on existing requests
                    updateConnectionButtonsState();
                }
            })
            .catch(error => {
                console.error('Error fetching connection requests:', error);
            });
    }

    /**
     * Update connection buttons state based on existing requests
     */
    function updateConnectionButtonsState() {
        const projectCards = document.querySelectorAll('#otherProjectsList .project-card');
        
        projectCards.forEach(card => {
            const projectId = parseInt(card.getAttribute('data-id'));
            const connectBtn = card.querySelector('.connect-btn');
            
            if (!connectBtn) return;
            
            // Check if there's already a connection request for this project
            const existingRequest = connectionRequests.find(req => 
                req.project_id === projectId && 
                req.from === username
            );
            
            if (existingRequest) {
                connectBtn.disabled = true;
                connectBtn.classList.remove('btn-outline-success');
                connectBtn.classList.add('btn-success');
                connectBtn.textContent = 'Request Sent';
            }
        });
    }
    
    /**
     * Render projects to the DOM
     * @param {string} section - Section ID (myProjects or otherProjects)
     * @param {Array} projects - Array of project objects
     */
    function renderProjects(section, projects) {
        const container = document.getElementById(`${section}List`);
        
        // Clear loading indicator
        const loadingEl = document.getElementById(`loading${section.charAt(0).toUpperCase() + section.slice(1)}`);
        if (loadingEl) {
            loadingEl.remove();
        }
        
        // If no projects, show message
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <p>No projects found.</p>
                </div>
            `;
            return;
        }
        
        // Create project cards
        projects.forEach(project => {
            const projectCard = createProjectCard(project, section);
            container.appendChild(projectCard);
        });

        // Update connection buttons state if needed
        if (section === 'otherProjects' && isLoggedIn && connectionRequests.length > 0) {
            updateConnectionButtonsState();
        }
    }
    
    /**
     * Create a project card element
     * @param {Object} project - Project data object
     * @param {string} section - Section ID (myProjects or otherProjects)
     * @returns {HTMLElement} - Project card DOM element
     */
    function createProjectCard(project, section) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4 project-card';
        col.setAttribute('data-category', project.category);
        col.setAttribute('data-id', project.id);
        
        // Format date
        let formattedDate = 'Not specified';
        if (project.startDate) {
            const startDate = new Date(project.startDate);
            formattedDate = startDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
        
        // Default image if none provided
        const imageUrl = project.image || 'static/assets/logo/grass.png';
        
        col.innerHTML = `
            <div class="card h-100">
                <div class="project-image-container">
                    <img src="${imageUrl}" class="card-img-top project-image" alt="${project.title}">
                    <span class="category-badge ${project.category}">${getCategoryName(project.category)}</span>
                </div>
                <div class="card-body">
                    <h5 class="card-title">${project.title}</h5>
                    <p class="card-text project-description">${truncateText(project.description, 100)}</p>
                    <div class="project-meta">
                        <span class="project-stage">${project.stage}</span>
                        <span class="project-date">${formattedDate}</span>
                    </div>
                    <div class="progress mt-3">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${project.progress || 0}%" 
                            aria-valuenow="${project.progress || 0}" aria-valuemin="0" aria-valuemax="100">
                            ${project.progress || 0}%
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-outline-success view-project-btn" data-id="${project.id}">
                        View Details
                    </button>
                    <span class="creator-info">by ${project.creator}</span>
                    ${section === 'otherProjects' && isLoggedIn ? 
                    `<button class="btn btn-sm btn-outline-success float-right connect-btn" 
                        data-id="${project.id}" data-creator="${project.creator}">
                        Connect
                    </button>` : ''}
                </div>
            </div>
        `;
        
        // Add event listener to view project button
        col.querySelector('.view-project-btn').addEventListener('click', function() {
            showProjectDetails(project.id);
        });

        // Add event listener to connect button if present
        const connectBtn = col.querySelector('.connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', function() {
                sendConnectionRequest(project.id, project.creator, this);
            });
        }
        
        return col;
    }
    
    /**
     * Send connection request to project creator
     * @param {number} projectId - Project ID
     * @param {string} creatorUsername - Username of project creator
     * @param {HTMLElement} button - Button element
     */
    function sendConnectionRequest(projectId, creatorUsername, button) {
        if (!isLoggedIn) {
            alert('Please log in to connect with project creators');
            window.location.href = '/login';
            return;
        }

        // Disable button and show loading state
        button.disabled = true;
        const originalText = button.textContent;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';

        fetch('/api/connection-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: creatorUsername,
                project_id: projectId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update button to show success
                button.textContent = 'Request Sent';
                button.classList.remove('btn-outline-success');
                button.classList.add('btn-success');
                
                // Add to local connection requests
                connectionRequests.push({
                    from: username,
                    to: creatorUsername,
                    project_id: projectId,
                    status: false
                });
                
                // Show success notification
                showNotification('success', 'Connection request sent successfully!');
            } else {
                // Restore button
                button.disabled = false;
                button.textContent = originalText;
                
                // Show error notification
                showNotification('error', data.message || 'Failed to send connection request');
            }
        })
        .catch(error => {
            console.error('Error sending connection request:', error);
            
            // Restore button
            button.disabled = false;
            button.textContent = originalText;
            
            // Show error notification
            showNotification('error', 'An error occurred. Please try again.');
        });
    }

    /**
     * Show notification message
     * @param {string} type - Notification type (success/error)
     * @param {string} message - Message to display
     */
    function showNotification(type, message) {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }

        // Set message and type
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Show notification
        notification.classList.add('show');
        
        // Hide after delay
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    /**
     * Filter projects by search term
     * @param {string} section - Section ID (myProjects or otherProjects)
     * @param {string} searchTerm - Search term
     */
    function filterProjects(section, searchTerm) {
        const projects = document.querySelectorAll(`#${section}List .project-card`);
        const term = searchTerm.toLowerCase().trim();
        
        projects.forEach(project => {
            const title = project.querySelector('.card-title').textContent.toLowerCase();
            const description = project.querySelector('.project-description').textContent.toLowerCase();
            
            if (title.includes(term) || description.includes(term)) {
                project.style.display = '';
            } else {
                project.style.display = 'none';
            }
        });
    }
    
    /**
     * Filter projects by category
     * @param {string} category - Category to filter by
     */
    function filterProjectsByCategory(category) {
        const projects = document.querySelectorAll('#otherProjectsList .project-card');
        
        projects.forEach(project => {
            if (category === 'all' || project.getAttribute('data-category') === category) {
                project.style.display = '';
            } else {
                project.style.display = 'none';
            }
        });
    }
    
    /**
     * Show project details in modal
     * @param {number} projectId - Project ID
     */
    function showProjectDetails(projectId) {
        // Find project in data
        let project = null;
        
        // Check in myProjects
        project = projectsData.myProjects.find(p => p.id === projectId);
        
        // If not found, check in otherProjects
        if (!project) {
            project = projectsData.otherProjects.find(p => p.id === projectId);
        }
        
        if (!project) {
            console.error('Project not found:', projectId);
            return;
        }
        
        // Format date
        let formattedDate = 'Not specified';
        if (project.startDate) {
            const startDate = new Date(project.startDate);
            formattedDate = startDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
        
        // Set modal title
        document.getElementById('projectDetailTitle').textContent = project.title;
        
        // Check if there's an existing connection request
        let connectionRequestSent = false;
        if (isLoggedIn && project.creator !== username) {
            connectionRequestSent = connectionRequests.some(req => 
                req.project_id === project.id && 
                req.from === username && 
                req.to === project.creator
            );
        }

        // Set modal content
        const modalContent = document.getElementById('projectDetailContent');
        modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <img src="${project.image || 'static/assets/logo/grass.png'}" class="img-fluid project-detail-image" alt="${project.title}">
                </div>
                <div class="col-md-6">
                    <div class="project-detail-meta">
                        <span class="badge badge-${getCategoryClass(project.category)}">${getCategoryName(project.category)}</span>
                        <span class="badge badge-info">${project.stage}</span>
                        <span class="badge badge-secondary">Started: ${formattedDate}</span>
                    </div>
                    <div class="progress mt-3 mb-3">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${project.progress || 0}%" 
                            aria-valuenow="${project.progress || 0}" aria-valuemin="0" aria-valuemax="100">
                            ${project.progress || 0}% Complete
                        </div>
                    </div>
                    <p class="project-creator">Created by: ${project.creator}</p>
                    ${isLoggedIn && project.creator !== username ? 
                    `<button class="btn btn-${connectionRequestSent ? 'success' : 'outline-success'} connect-detail-btn" 
                        data-id="${project.id}" data-creator="${project.creator}" 
                        ${connectionRequestSent ? 'disabled' : ''}>
                        ${connectionRequestSent ? 'Connection Request Sent' : 'Connect with Creator'}
                    </button>` : ''}
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-12">
                    <h5>Project Description</h5>
                    <p>${project.description}</p>
                </div>
            </div>
        `;
        
        // Show or hide edit button based on ownership
        const editBtn = document.getElementById('editProjectBtn');
        if (editBtn) {
            if (isLoggedIn && project.creator === username) {
                editBtn.style.display = 'inline-block';
                editBtn.setAttribute('data-id', project.id);
            } else {
                editBtn.style.display = 'none';
            }
        }

        // Add event listener to connect button in modal if present
        const connectDetailBtn = modalContent.querySelector('.connect-detail-btn');
        if (connectDetailBtn && !connectionRequestSent) {
            connectDetailBtn.addEventListener('click', function() {
                sendConnectionRequest(project.id, project.creator, this);
            });
        }
        
        // Show modal
        $('#projectDetailModal').modal('show');
    }
    
    /**
     * Create a new project
     */
    function createProject() {
        // Get form values
        const title = document.getElementById('projectTitle').value;
        const description = document.getElementById('projectDescription').value;
        const category = document.getElementById('projectCategory').value;
        const stage = document.getElementById('projectStage').value;
        const startDate = document.getElementById('projectStartDate').value;
        const progress = document.getElementById('projectProgress').value;
        const image = document.getElementById('projectImage').value;
        
        // Validate form
        if (!title || !description || !category || !stage) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Create project object
        const newProject = {
            title,
            description,
            category,
            stage,
            startDate: startDate || new Date().toISOString().split('T')[0],
            progress: parseInt(progress) || 0,
            image
        };
        
        // Send project data to API
        fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newProject)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Add the new project to our data store
                projectsData.myProjects.push(data.project);
                
                // Create and add project card to the DOM
                const projectCard = createProjectCard(data.project, 'myProjects');
                document.getElementById('myProjectsList').appendChild(projectCard);
                
                // Reset form and close modal
                document.getElementById('createProjectForm').reset();
                $('#createProjectModal').modal('hide');
                
                // Show success notification
                showNotification('success', 'Project created successfully!');
            } else {
                showNotification('error', data.message || 'Failed to create project');
            }
        })
        .catch(error => {
            console.error('Error creating project:', error);
            showNotification('error', 'An error occurred. Please try again.');
        });
    }
    
    /**
     * Helper function to get category name from category code
     * @param {string} category - Category code
     * @returns {string} - Category display name
     */
    function getCategoryName(category) {
        const categories = {
            'tech': 'Technology',
            'finance': 'Finance',
            'health': 'Health',
            'education': 'Education',
            'environment': 'Environment',
            'other': 'Other'
        };
        
        return categories[category] || 'Other';
    }
    
    /**
     * Helper function to get Bootstrap class for category
     * @param {string} category - Category code
     * @returns {string} - Bootstrap class
     */
    function getCategoryClass(category) {
        const classes = {
            'tech': 'primary',
            'finance': 'warning',
            'health': 'danger',
            'education': 'info',
            'environment': 'success',
            'other': 'secondary'
        };
        
        return classes[category] || 'secondary';
    }
    
    /**
     * Helper function to truncate text
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} - Truncated text
     */
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substr(0, maxLength) + '...';
    }
});
document.addEventListener('DOMContentLoaded', function() {
    // Get username from body data attribute (set by Jinja2)
    const loggedInUsername = document.body.getAttribute('data-username');
    const isLoggedIn = !!loggedInUsername;

    // Element References
    const pendingRequestsSection = document.getElementById('pendingRequestsSection');
    const pendingRequestsList = document.getElementById('pendingRequestsList');
    const connectionsSection = document.getElementById('connectionsSection');
    const connectionsList = document.getElementById('connectionsList');
    const sharedTodoSection = document.getElementById('sharedTodoSection');
    const sharedTodoListsContainer = document.getElementById('sharedTodoLists');
    const noSharedListsMsg = document.getElementById('noSharedListsMsg');
    const loadingSharedListsMsg = document.getElementById('loadingSharedListsMsg');
    const createTodoListBtn = document.getElementById('createTodoListBtn');
    const todoPartnerNameSpan = document.getElementById('todoPartnerName');
    const createTodoListModal = $('#createTodoListModal'); // jQuery object for modal
    const createTodoListForm = document.getElementById('createTodoListForm');
    const saveTodoListBtn = document.getElementById('saveTodoListBtn');
    const todoPartnerUsernameInput = document.getElementById('todoPartnerUsername');
    const todoListTitleInput = document.getElementById('todoListTitle');
    const connectionSectionTitle = document.getElementById('connectionSectionTitle');
    const connectionDetailsDisplay = document.getElementById('connectionDetailsDisplay');
    const breadcrumbPartnerName = document.getElementById('breadcrumbPartnerName');
    const addTaskModal = $('#addTaskModal'); // jQuery object for modal
    const addTaskForm = document.getElementById('addTaskForm');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const taskTitleInput = document.getElementById('taskTitle');
    const addTaskModalListIdInput = document.getElementById('addTaskModalListId');
    const backToConnectionsBtn = document.getElementById('backToConnectionsBtn');

    // --- Connection Request Handling ---
    function fetchPendingRequests() {
        if (!isLoggedIn) {
            pendingRequestsSection.style.display = 'none';
            return;
        }

        fetch('/api/connections/pending')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                pendingRequestsList.innerHTML = ''; // Clear loading/previous
                if (data.success && data.requests && data.requests.length > 0) {
                    data.requests.forEach(req => {
                        const requestElement = document.createElement('div');
                        requestElement.className = 'list-group-item list-group-item-action flex-column align-items-start';
                        requestElement.innerHTML = `
                            <div class="d-flex w-100 justify-content-between">
                                <p class="mb-1">Connection request from: <strong>${req.from}</strong></p>
                                <small>Project ID: ${req.project_id || 'N/A'}</small>
                            </div>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-success accept-request-btn" data-request-id="${req.id}" data-from-user="${req.from}">Accept</button>
                                <!-- <button class="btn btn-sm btn-danger decline-request-btn ml-2" data-request-id="${req.id}">Decline</button> -->
                            </div>
                        `;
                        pendingRequestsList.appendChild(requestElement);
                    });
                    pendingRequestsSection.style.display = 'block';
                    document.querySelector('.connection-section').style.paddingTop = '30px';
                } else {
                    pendingRequestsSection.style.display = 'none';
                    document.querySelector('.connection-section').style.paddingTop = '60px';
                }
            })
            .catch(error => {
                console.error('Error fetching pending requests:', error);
                pendingRequestsList.innerHTML = '<p class="text-danger text-center">Error loading requests.</p>';
                pendingRequestsSection.style.display = 'block';
            });
    }

    function acceptRequest(requestId, fromUsername, button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Accepting...';

        fetch(`/api/connections/accept/${requestId}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
         })
            .then(response => response.json().then(data => ({ status: response.status, body: data })))
            .then(({ status, body }) => {
                if (status === 200 && body.success) {
                    // alert('Connection accepted!'); // Optional feedback
                    const itemToRemove = button.closest('.list-group-item');
                    itemToRemove.style.transition = 'opacity 0.5s ease-out, height 0.5s ease-out';
                    itemToRemove.style.opacity = '0';
                    itemToRemove.style.height = '0';
                    itemToRemove.style.padding = '0';
                    itemToRemove.style.marginBottom = '0';
                    setTimeout(() => {
                        itemToRemove.remove();
                        if (pendingRequestsList.children.length === 0) {
                            pendingRequestsSection.style.display = 'none';
                            document.querySelector('.connection-section').style.paddingTop = '60px';
                        }
                    }, 500);

                    // After accepting, refresh the connections list
                    fetchConnections();
                    
                    const currentPartner = getCurrentPartnerUsername();
                    if (!currentPartner || currentPartner !== fromUsername) {
                        // Option: Navigate or refresh to show the new connection context
                        window.location.href = `/connection?partner=${fromUsername}`;
                    } else {
                        checkConnectionAndLoadTodos(fromUsername); // Refresh if already viewing
                    }
                } else {
                    alert(`Failed to accept: ${body.detail || body.message || 'Unknown error'}`);
                    button.disabled = false;
                    button.textContent = 'Accept';
                }
            })
            .catch(error => {
                console.error('Error accepting request:', error);
                alert('An error occurred while accepting the request.');
                button.disabled = false;
                button.textContent = 'Accept';
            });
    }

    pendingRequestsList.addEventListener('click', function(event) {
        if (event.target.classList.contains('accept-request-btn')) {
            const requestId = parseInt(event.target.getAttribute('data-request-id'));
            const fromUsername = event.target.getAttribute('data-from-user');
            acceptRequest(requestId, fromUsername, event.target);
        }
    });

    // --- Fetch All Connections ---
    function fetchConnections() {
        if (!isLoggedIn) {
            connectionsSection.style.display = 'none';
            return;
        }

        // Since there's no direct API for getting all connections,
        // we'll use our own function to get connections
        // Create an API endpoint or use available data structure
        connectionsList.innerHTML = '<p class="text-center text-muted">Loading connections...</p>';
        
        // For this example, let's simulate the API call that should be implemented
        fetch('/api/connections')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                connectionsList.innerHTML = ''; // Clear loading message
                
                const connections = data.connections || [];
                
                if (connections.length > 0) {
                    connections.forEach(connection => {
                        // Find partner username (the one that's not current user)
                        const partnerUsername = connection.users.find(user => user !== loggedInUsername);
                        
                        if (partnerUsername) {
                            const connectionElement = document.createElement('div');
                            connectionElement.className = 'list-group-item d-flex justify-content-between align-items-center';
                            connectionElement.innerHTML = `
                                <div>
                                    <strong>${escapeHtml(partnerUsername)}</strong>
                                    ${connection.project_id ? `<span class="badge badge-info ml-2">Project ID: ${connection.project_id}</span>` : ''}
                                </div>
                                <button class="btn btn-primary btn-sm view-connection-btn" 
                                        data-partner="${escapeHtml(partnerUsername)}">
                                    View To-Do Lists
                                </button>
                            `;
                            connectionsList.appendChild(connectionElement);
                        }
                    });
                    
                    if (connectionsList.children.length > 0) {
                        connectionsSection.style.display = 'block';
                    } else {
                        connectionsList.innerHTML = '<p class="text-center text-muted">No active connections found.</p>';
                        connectionsSection.style.display = 'block';
                    }
                } else {
                    connectionsList.innerHTML = '<p class="text-center text-muted">No active connections found.</p>';
                    connectionsSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error fetching connections:', error);
                connectionsList.innerHTML = `
                    <div class="alert alert-danger text-center">
                        <p>Error loading connections.</p>
                        <p class="mt-2">Please check if the API endpoint is implemented correctly.</p>
                    </div>
                `;
                connectionsSection.style.display = 'block';
            });
    }

    // --- Connection click handler ---
    if (connectionsList) {
        connectionsList.addEventListener('click', function(event) {
            const viewBtn = event.target.closest('.view-connection-btn');
            if (viewBtn) {
                const partnerUsername = viewBtn.getAttribute('data-partner');
                if (partnerUsername) {
                    // Update URL without reloading page
                    const url = new URL(window.location);
                    url.searchParams.set('partner', partnerUsername);
                    window.history.pushState({}, '', url);
                    
                    // Load the todo lists for this connection
                    checkConnectionAndLoadTodos(partnerUsername);
                }
            }
        });
    }

    // --- Shared ToDo List Handling ---
    function calculateProgress(tasks) {
        if (!tasks || tasks.length === 0) return 0;
        const completedTasks = tasks.filter(task => task.status === true).length;
        return Math.round((completedTasks / tasks.length) * 100);
    }

    // Helper function to generate HTML for a single task
    function createTaskHtml(listId, task) {
        return `
            <li class="d-flex align-items-center task-item ${task.status ? 'task-done' : ''}" data-task-id="${task.id}">
                <div class="form-check flex-grow-1">
                    <input class="form-check-input task-checkbox" type="checkbox" value="" id="task-${listId}-${task.id}"
                           data-list-id="${listId}" data-task-id="${task.id}" ${task.status ? 'checked' : ''}>
                    <label class="form-check-label" for="task-${listId}-${task.id}">
                        ${escapeHtml(task.title || 'Untitled Task')}
                    </label>
                </div>
            </li>`;
    }

    function displaySharedTodoLists(todolists, partnerUsername) {
        sharedTodoListsContainer.innerHTML = ''; // Clear previous/loading
        if (!todolists || todolists.length === 0) {
            noSharedListsMsg.style.display = 'block';
            loadingSharedListsMsg.style.display = 'none';
            return;
        }
        noSharedListsMsg.style.display = 'none';
        loadingSharedListsMsg.style.display = 'none';

        todolists.forEach(list => {
            const listElement = document.createElement('div');
            listElement.className = 'todo-list-item'; // Class handles styling now
            listElement.setAttribute('data-list-id', list.id);

            const progress = calculateProgress(list.tasks);
            let tasksHtml = `<ul class="list-unstyled mb-2 task-list-ul" id="tasks-for-list-${list.id}">`;

            if (list.tasks && list.tasks.length > 0) {
                 tasksHtml += list.tasks.map(task => createTaskHtml(list.id, task)).join('');
            } else {
                tasksHtml += '<li class="no-tasks-msg"><small class="text-muted">No tasks in this list yet.</small></li>';
            }
            tasksHtml += '</ul>';

            const progressBarHtml = `
                <div class="progress" style="height: 10px;">
                  <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%;"
                       aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <small class="text-muted progress-text">${progress}% Complete</small>
            `;

            listElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3"> <!-- Increased margin bottom -->
                    <h5 class="mb-0">${escapeHtml(list.title || 'Untitled List')}</h5>
                    <button class="btn btn-outline-secondary btn-sm add-task-btn" data-list-id="${list.id}">
                        <i class="fas fa-plus"></i> Add Task
                    </button>
                </div>
                ${tasksHtml}
                ${progressBarHtml}
            `;
            sharedTodoListsContainer.appendChild(listElement);
        });
        
        // Check for completed lists after displaying
        setTimeout(checkExistingCompletedLists, 100);
    }

    function checkConnectionAndLoadTodos(partnerUsername) {
        if (!isLoggedIn || !partnerUsername) {
            sharedTodoSection.style.display = 'none';
            return;
        }
    
        // Update UI elements for the specific partner view
        todoPartnerNameSpan.textContent = escapeHtml(partnerUsername);
        todoPartnerUsernameInput.value = partnerUsername;
        connectionSectionTitle.textContent = `Loading project...`;
        connectionDetailsDisplay.textContent = `Manage your shared tasks with ${escapeHtml(partnerUsername)}.`;
        breadcrumbPartnerName.textContent = `/ ${escapeHtml(partnerUsername)}`;
    
        // Prepare UI for loading
        sharedTodoListsContainer.innerHTML = '';
        loadingSharedListsMsg.style.display = 'block';
        noSharedListsMsg.style.display = 'none';
        sharedTodoSection.style.display = 'block';
    
        // Hide connections section when viewing specific connection
        connectionsSection.style.display = 'none';
    
        // Fetch shared todo lists
        fetch(`/api/todolists/shared/${partnerUsername}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                loadingSharedListsMsg.style.display = 'none';
                if (data.success) {
                    displaySharedTodoLists(data.todolists, partnerUsername);
    
                    // --- NEW: Extract project_id and fetch project title
                    const firstList = data.todolists[0];
                    const projectId = firstList?.project_id;
    
                    if (projectId) {
                        fetch(`/api/projects/${projectId}`)
                            .then(res => res.json())
                            .then(projectData => {
                                if (projectData.success && projectData.project) {
                                    connectionSectionTitle.textContent = `Project: ${escapeHtml(projectData.project.title)}`;
                                } else {
                                    connectionSectionTitle.textContent = `Project ID: ${escapeHtml(projectId)}`;
                                }
                            })
                            .catch(err => {
                                console.warn("Failed to load project title:", err);
                                connectionSectionTitle.textContent = `Project ID: ${escapeHtml(projectId)}`;
                            });
                    } else {
                        connectionSectionTitle.textContent = `Shared Tasks with ${escapeHtml(partnerUsername)}`;
                    }
    
                } else {
                    noSharedListsMsg.textContent = "Could not load shared lists or not connected.";
                    noSharedListsMsg.style.display = 'block';
                    console.warn("Could not fetch shared lists or API returned success: false.");
                }
            })
            .catch(error => {
                loadingSharedListsMsg.style.display = 'none';
                noSharedListsMsg.textContent = "Error loading shared lists.";
                noSharedListsMsg.style.display = 'block';
                console.error('Error fetching shared todolists:', error);
            });
    }
    

    function checkExistingCompletedLists() {
        const todoLists = document.querySelectorAll('.todo-list-item');
        todoLists.forEach(list => {
            const progressBar = list.querySelector('.progress-bar');
            if (progressBar && progressBar.getAttribute('aria-valuenow') === '100') {
                showCongratulations(list);
            }
        });
    }
    
    // --- Task Status Update Handling (Checkbox) ---
    sharedTodoListsContainer.addEventListener('change', function(event) {
        if (event.target.classList.contains('task-checkbox')) {
            const checkbox = event.target;
            const listId = parseInt(checkbox.getAttribute('data-list-id'));
            const taskId = parseInt(checkbox.getAttribute('data-task-id'));
            const isChecked = checkbox.checked;
            const taskItemLi = checkbox.closest('.task-item');
            const listContainerDiv = checkbox.closest('.todo-list-item');

            checkbox.disabled = true;

            fetch(`/api/todolists/${listId}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status: isChecked })
            })
            .then(response => response.json().then(data => ({ status: response.status, body: data })))
            .then(({ status, body }) => {
                if (status === 200 && body.success) {
                    taskItemLi.classList.toggle('task-done', isChecked);
                    updateProgressBar(listContainerDiv);
                } else {
                    checkbox.checked = !isChecked;
                    alert(`Failed to update task: ${body.detail || body.message || 'Unknown error'}`);
                }
            })
            .catch(error => {
                console.error('Error updating task status:', error);
                checkbox.checked = !isChecked;
                alert('An error occurred while updating the task.');
            })
            .finally(() => {
                checkbox.disabled = false;
            });
        }
    });

    function updateProgressBar(listContainerDiv) {
        if (!listContainerDiv) return;
        const taskCheckboxes = listContainerDiv.querySelectorAll('.task-checkbox');
        const totalTasks = taskCheckboxes.length;
        const progressBar = listContainerDiv.querySelector('.progress-bar');
        const progressText = listContainerDiv.querySelector('.progress-text');
    
        if (totalTasks === 0) {
             if(progressBar) progressBar.style.width = '0%';
             if(progressBar) progressBar.setAttribute('aria-valuenow', '0');
             if(progressText) progressText.textContent = '0% Complete';
             return;
        }
    
        let completedTasks = 0;
        taskCheckboxes.forEach(cb => { if (cb.checked) completedTasks++; });
    
        const progressPercentage = Math.round((completedTasks / totalTasks) * 100);
    
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
            progressBar.setAttribute('aria-valuenow', progressPercentage);
        }
        if (progressText) {
            progressText.textContent = `${progressPercentage}% Complete`;
        }
        
        // Check if all tasks are completed (100%)
        if (progressPercentage === 100) {
            showCongratulations(listContainerDiv);
        } else {
            // If percentage is not 100%, remove any existing congratulations banner
            const existingBanner = listContainerDiv.querySelector('.congratulations-banner');
            if (existingBanner) {
                existingBanner.remove();
            }
        }
    }

    // --- Add Task Modal Trigger ---
     sharedTodoListsContainer.addEventListener('click', function(event) {
        const addTaskButton = event.target.closest('.add-task-btn'); // More robust selector
        if (addTaskButton) {
            const listId = addTaskButton.getAttribute('data-list-id');
            if (listId) {
                addTaskModalListIdInput.value = listId;
                addTaskForm.reset();
                addTaskModal.modal('show');
                // Optional: Focus the input field when modal opens
                addTaskModal.on('shown.bs.modal', function () {
                    taskTitleInput.focus();
                });
                 addTaskModal.on('hidden.bs.modal', function () {
                     // Remove the event listener when modal is hidden
                     $(this).off('shown.bs.modal');
                 });
            }
        }
    });

    // --- Save New Task ---
    saveTaskBtn.addEventListener('click', () => {
        const title = taskTitleInput.value.trim();
        const listId = parseInt(addTaskModalListIdInput.value);

        if (!title) {
            alert('Please enter a task title.');
            taskTitleInput.focus(); return;
        }
        if (!listId) {
            alert('Error: Could not determine the list ID.'); return;
        }

        saveTaskBtn.disabled = true;
        saveTaskBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

        fetch(`/api/todolists/${listId}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ title: title })
        })
        .then(response => response.json().then(data => ({ status: response.status, body: data })))
        .then(({ status, body }) => {
            if (status === 200 && body.success && body.task) {
                addTaskModal.modal('hide');

                const listContainerDiv = sharedTodoListsContainer.querySelector(`.todo-list-item[data-list-id="${listId}"]`);
                if (listContainerDiv) {
                    const taskListUl = listContainerDiv.querySelector('.task-list-ul');
                    if (taskListUl) {
                        const noTasksMsg = taskListUl.querySelector('.no-tasks-msg');
                        if (noTasksMsg) noTasksMsg.remove();

                        const newTaskHtml = createTaskHtml(listId, body.task);
                        taskListUl.insertAdjacentHTML('beforeend', newTaskHtml);
                        updateProgressBar(listContainerDiv);
                    }
                } else {
                    // Fallback: Refresh lists if container not found
                    checkConnectionAndLoadTodos(getCurrentPartnerUsername());
                }
            } else {
                 alert(`Failed to add task: ${body.detail || body.message || 'Unknown error'}`);
            }
        })
        .catch(error => {
             console.error('Error adding task:', error);
             alert('An error occurred while adding the task.');
        })
        .finally(() => {
            saveTaskBtn.disabled = false;
            saveTaskBtn.textContent = 'Add Task';
        });
    });

    // --- Create ToDo List Modal Logic ---
    createTodoListBtn.addEventListener('click', () => {
        if (todoPartnerUsernameInput.value) {
            createTodoListForm.reset();
            createTodoListModal.modal('show');
        } else {
            alert("Cannot determine the partner to create a list with. Please ensure you are viewing a specific connection.");
        }
    });

    saveTodoListBtn.addEventListener('click', () => {
        const title = todoListTitleInput.value.trim();
        const partnerUsername = todoPartnerUsernameInput.value;

        if (!title) {
            alert('Please provide a title for the list.');
            todoListTitleInput.focus(); return;
        }
        if (!partnerUsername) {
            alert('Error: Partner username is missing.'); return;
        }

        saveTodoListBtn.disabled = true;
        saveTodoListBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';

        // Match the backend model expected structure
        const projectIdBadge = document.querySelector('.badge.badge-info'); // lấy từ badge Project ID đang hiển thị
        const projectId = projectIdBadge ? projectIdBadge.textContent.replace('Project ID: ', '').trim() : null;

        const newListData = { 
            title: title,
            partner_username: partnerUsername, 
            tasks: [],
            project_id: projectId || null  // thêm project_id nếu có
        };

        fetch('/api/todolists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(newListData)
        })
        .then(response => response.json().then(data => ({ status: response.status, body: data })))
        .then(({ status, body }) => {
            if (status === 200 && body.success) {
                createTodoListModal.modal('hide');
                checkConnectionAndLoadTodos(partnerUsername); // Refresh list view
            } else {
                 alert(`Failed to create list: ${body.detail || body.message || 'Unknown error'}`);
            }
        })
        .catch(error => {
             console.error('Error creating todolist:', error);
             alert('An error occurred while creating the list.');
        })
        .finally(() => {
            saveTodoListBtn.disabled = false;
            saveTodoListBtn.textContent = 'Create List';
        });
    });

    // --- Back to Connections button ---
    if (backToConnectionsBtn) {
        backToConnectionsBtn.addEventListener('click', function() {
            // Clear partner from URL
            const url = new URL(window.location);
            url.searchParams.delete('partner');
            window.history.pushState({}, '', url);
            
            // Hide todo section and show connections
            sharedTodoSection.style.display = 'none';
            connectionSectionTitle.textContent = 'Your Connections';
            connectionDetailsDisplay.textContent = 'Select a connection below to view and manage shared tasks.';
            breadcrumbPartnerName.textContent = '';
            connectionsSection.style.display = 'block';
            
            // Refresh connections list
            fetchConnections();
        });
    }

    // --- Helper to get current partner context ---
    function getCurrentPartnerUsername() {
         const urlParams = new URLSearchParams(window.location.search);
         return urlParams.get('partner');
    }

    // --- Utility to escape HTML ---
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe; // Return non-strings as is
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function showCongratulations(listContainerDiv) {
        // Check if banner already exists
        if (listContainerDiv.querySelector('.congratulations-banner')) {
            return; // Banner already exists, don't add another one
        }
        
        const listTitle = listContainerDiv.querySelector('h5').textContent;
        
        // Create congratulations banner
        const congratsBanner = document.createElement('div');
        congratsBanner.className = 'congratulations-banner';
        congratsBanner.innerHTML = `
            <p class="congratulations-text">🎉 Congratulations! You've completed all tasks in "${escapeHtml(listTitle)}"!</p>
            <button class="dismiss-congrats" aria-label="Dismiss" title="Dismiss">×</button>
        `;
        
        // Add banner after the progress bar
        const progressContainer = listContainerDiv.querySelector('.progress-text');
        progressContainer.parentNode.insertBefore(congratsBanner, progressContainer.nextSibling);
        
        // Add celebration animation to the whole list container
        listContainerDiv.classList.add('celebrate');
        setTimeout(() => {
            listContainerDiv.classList.remove('celebrate');
        }, 500);
        
        // Add event listener to dismiss button
        const dismissButton = congratsBanner.querySelector('.dismiss-congrats');
        dismissButton.addEventListener('click', function() {
            congratsBanner.style.animation = 'fadeIn 0.5s ease-in reverse';
            setTimeout(() => {
                congratsBanner.remove();
            }, 500);
        });
    }

    // --- Initial Load ---
    fetchPendingRequests(); // Always check for pending requests
    
    const viewingPartnerUsername = getCurrentPartnerUsername();

    if (viewingPartnerUsername) {
        checkConnectionAndLoadTodos(viewingPartnerUsername);
    } else {
        // No specific partner context - show connections list
        sharedTodoSection.style.display = 'none';
        connectionSectionTitle.textContent = `Your Connections`;
        connectionDetailsDisplay.textContent = `Select a connection below to view and manage shared tasks.`;
        breadcrumbPartnerName.textContent = '';
        fetchConnections(); // Load all connections
    }
});
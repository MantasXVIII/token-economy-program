document.addEventListener('DOMContentLoaded', async () => {
  let token = null;
  let role = null;
  let tasks = [];
  let target = { target: 200, image: null }; // Default target
  let overallTotal = 0;

  async function fetchTasks() {
    try {
      const response = await fetch('/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      tasks = await response.json();
      console.log('Tasks loaded:', tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }

  async function fetchTarget() {
    try {
      const response = await fetch('/target');
      if (response.ok) {
        const data = await response.json();
        target = { ...target, ...data }; // Merge with default
        document.getElementById('target-value').textContent = target.target;
        const targetImage = document.getElementById('target-image');
        if (target.image) {
          targetImage.src = target.image;
          targetImage.classList.remove('hidden');
        } else {
          targetImage.classList.add('hidden');
        }
      } else {
        console.warn('Failed to fetch target, using default:', target.target);
        document.getElementById('target-value').textContent = target.target;
      }
    } catch (error) {
      console.error('Error fetching target:', error);
      document.getElementById('target-value').textContent = target.target;
    }
  }

  function generateTableHeader(containerId) {
    const thead = document.getElementById(containerId);
    let headerHTML = '<tr>';
    headerHTML += '<th class="border p-2">Day</th>';
    tasks.forEach((task, index) => {
      const taskNum = index; // 0-based index
      headerHTML += `<th class="border p-2 task-header" data-task="${taskNum}">${task.name}</th>`;
    });
    headerHTML += '<th class="border p-2">Weekly Total</th>'; // Add total column
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    // Add click event listeners to task headers with logging
    document.querySelectorAll('.task-header').forEach(header => {
      header.addEventListener('click', () => {
        const taskIndex = parseInt(header.dataset.task);
        console.log('Clicked task index:', taskIndex, 'Tasks array:', tasks);
        showTaskDescription(taskIndex);
      });
    });
  }

  function showTaskDescription(taskIndex) {
    if (taskIndex >= 0 && taskIndex < tasks.length) {
      const task = tasks[taskIndex];
      console.log('Showing description for:', task.name, 'Description:', task.description);
      document.getElementById('task-title').textContent = task.name;
      document.getElementById('task-desc').textContent = task.description;
      const descriptionDiv = document.getElementById('task-description');
      descriptionDiv.classList.remove('hidden');
      descriptionDiv.querySelector('.bg-white').scrollTop = 0; // Reset scroll
    } else {
      console.error('Invalid task index:', taskIndex, 'Available tasks:', tasks);
    }
  }

  document.getElementById('close-description').addEventListener('click', () => {
    document.getElementById('task-description').classList.add('hidden');
  });

  window.updateWeeklyTotal = function () {
    let total = 0;
    const maxTotal = tasks.reduce((sum, task) => sum + task.points, 0); // Max possible points
    const checkboxes = document.querySelectorAll('#grid-body input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
      const taskNum = checkbox.closest('td').cellIndex; // Get column index (1-based for tasks)
      if (taskNum > 0 && taskNum <= tasks.length) {
        total += tasks[taskNum - 1].points; // Subtract 1 for 0-based array
      }
    });
    const targetValue = target.target || 200; // Use fetched target or default
    document.getElementById('weekly-progress').textContent = `Weekly Total: ${total} points | Total to Target: ${total} / ${targetValue} | Overall Total: ${overallTotal} points`;
  };

  function calculateWeeklyTotalForHistory(grid) {
    let total = 0;
    for (const day in grid) {
      tasks.forEach((task, index) => {
        const taskKey = `task${index + 1}`;
        if (grid[day][taskKey]) {
          total += task.points;
        }
      });
    }
    return total;
  }

  async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    console.log('Attempting login with:', { username, password: '****' });
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      console.log('Login response data:', data);
      if (response.ok && data.token) {
        token = data.token;
        role = data.role;
        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await Promise.all([fetchTasks(), fetchTarget()]); // Fetch both in parallel
        generateTableHeader('grid-header');
        generateTableHeader('history-header');
        loadGrid();
        updateWeeklyTotal(); // Initialize total
        updateOverallTotal(); // Initialize overall total
      } else {
        alert('Login failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed due to an error: ' + error.message);
    }
  }

  async function loadGrid() {
    try {
      const response = await fetch('/grid', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load grid');
      const grid = await response.json();
      const tbody = document.getElementById('grid-body');
      tbody.innerHTML = '';
      for (const [day, taskStates] of Object.entries(grid)) {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="border p-2">${day}</td>`;
        tasks.forEach((task, index) => {
          const taskKey = `task${index + 1}`;
          const checked = taskStates[taskKey] ? 'checked' : '';
          const disabled = role === 'viewer' ? 'disabled' : '';
          row.innerHTML += `<td class="border p-2 text-center"><input type="checkbox" ${checked} ${disabled} onchange="updateTask('grid', '${day}', '${taskKey}', this.checked); updateWeeklyTotal();"></td>`;
        });
        row.innerHTML += `<td class="border p-2">${calculateWeeklyTotalForHistory({ [day]: taskStates })} points</td>`; // Add weekly total
        tbody.appendChild(row);
      }
      updateWeeklyTotal(); // Update after loading
    } catch (error) {
      console.error('Error loading grid:', error);
    }
  }

  async function updateTask(endpoint, day, task, value) {
    try {
      await fetch(`/${endpoint}${endpoint === 'history' ? '/' + document.getElementById('history-select').value : ''}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, task, value }),
      });
      if (endpoint === 'grid') loadGrid();
      else loadHistory();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  async function viewHistory() {
    const historyDiv = document.getElementById('history');
    historyDiv.classList.toggle('hidden');
    if (!historyDiv.classList.contains('hidden')) {
      try {
        const response = await fetch('/history', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to load history');
        const history = await response.json();
        const select = document.getElementById('history-select');
        select.innerHTML = '<option value="">Select a week</option>';
        history.forEach(({ week }) => {
          const option = document.createElement('option');
          option.value = week;
          option.textContent = week;
          select.appendChild(option);
        });
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }
  }

  async function loadHistory() {
    const week = document.getElementById('history-select').value;
    if (!week) return;
    try {
      const response = await fetch(`/history/${week}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load history data');
      const grid = await response.json();
      const tbody = document.getElementById('history-body');
      tbody.innerHTML = '';
      for (const [day, taskStates] of Object.entries(grid)) {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="border p-2">${day}</td>`;
        tasks.forEach((task, index) => {
          const taskKey = `task${index + 1}`;
          const checked = taskStates[taskKey] ? 'checked' : '';
          const disabled = role === 'viewer' ? 'disabled' : '';
          row.innerHTML += `<td class="border p-2 text-center"><input type="checkbox" ${checked} ${disabled} onchange="updateTask('history', '${day}', '${taskKey}', this.checked)"></td>`;
        });
        row.innerHTML += `<td class="border p-2">${calculateWeeklyTotalForHistory({ [day]: taskStates })} points</td>`; // Add weekly total
        tbody.appendChild(row);
      }
      updateOverallTotal(); // Update overall total after loading history
      // Ensure container adjusts after loading
      const container = document.getElementById('history-table-container');
      const table = container.querySelector('table');
      if (table) {
        container.style.minWidth = `${table.scrollWidth}px`; // Match table width
      }
    } catch (error) {
      console.error('Error loading history data:', error);
    }
  }

  function updateOverallTotal() {
    let total = 0;
    const historyItems = document.querySelectorAll('#history-body tr td:last-child');
    historyItems.forEach(item => {
      const points = parseInt(item.textContent) || 0;
      total += points;
    });
    overallTotal = total; // Update global variable
    updateWeeklyTotal(); // Reflect in UI
  }

  async function saveHistory() {
    try {
      const response = await fetch('/save-history', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        alert(`History saved for week ${data.week}`);
        viewHistory(); // Refresh history dropdown
      } else {
        alert('Failed to save history: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving history:', error);
      alert('Failed to save history due to an error');
    }
  }

  document.getElementById('target-reached-btn').addEventListener('click', () => {
    overallTotal = 0;
    updateWeeklyTotal(); // Reset overall total
    alert('Target reached! Progress has been reset.');
  });

  // Bind the existing button
  document.getElementById('save-history-btn').onclick = saveHistory;

  window.login = login;
  window.updateTask = updateTask;
  window.viewHistory = viewHistory;
  window.loadHistory = loadHistory;
});

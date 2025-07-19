document.addEventListener('DOMContentLoaded', async () => {
  let token = null;
  let role = null;
  let tasks = [];

  async function fetchTasks() {
    try {
      const response = await fetch('/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      tasks = await response.json();
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }

  function generateTableHeader(containerId) {
    const thead = document.getElementById(containerId);
    let headerHTML = '<tr>';
    headerHTML += '<th class="border p-2">Day</th>';
    tasks.forEach((task, index) => {
      const taskNum = index + 1;
      headerHTML += `<th class="border p-2 task-header" data-task="${taskNum}">${task.name}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

    // Add click event listeners to task headers
    document.querySelectorAll('.task-header').forEach(header => {
      header.addEventListener('click', () => showTaskDescription(header.dataset.task));
    });
  }

  function showTaskDescription(taskNum) {
    const task = tasks.find(t => t.name === `Task ${taskNum}`);
    if (task) {
      document.getElementById('task-title').textContent = task.name;
      document.getElementById('task-desc').textContent = task.description;
      document.getElementById('task-description').classList.remove('hidden');
    }
  }

  document.getElementById('close-description').addEventListener('click', () => {
    document.getElementById('task-description').classList.add('hidden');
  });

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
        await fetchTasks();
        generateTableHeader('grid-header');
        generateTableHeader('history-header');
        loadGrid();
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
          row.innerHTML += `<td class="border p-2 text-center"><input type="checkbox" ${checked} ${disabled} onchange="updateTask('grid', '${day}', '${taskKey}', this.checked)"></td>`;
        });
        tbody.appendChild(row);
      }
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
        tbody.appendChild(row);
      }
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

  // Bind the existing button
  document.getElementById('save-history-btn').onclick = saveHistory;

  window.login = login;
  window.updateTask = updateTask;
  window.viewHistory = viewHistory;
  window.loadHistory = loadHistory;
});

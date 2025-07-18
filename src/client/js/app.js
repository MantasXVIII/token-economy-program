// src/client/js/app.js
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
    let headerHTML = '<tr><th class="border p-2">Day</th>';
    tasks.forEach((task, index) => {
      headerHTML += `<th class="border p-2">Task ${index + 1}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;
  }

  async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      console.log('Login response:', await response.text());
      const data = await response.json();
      if (data.token) {
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

  // Add a save button to the DOM
  const appDiv = document.getElementById('app');
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save History';
  saveButton.className = 'bg-green-500 text-white p-2 rounded hover:bg-green-600 mt-2';
  saveButton.onclick = saveHistory;
  appDiv.insertBefore(saveButton, appDiv.children[2]); // Insert before the View History button

  window.login = login;
  window.updateTask = updateTask;
  window.viewHistory = viewHistory;
  window.loadHistory = loadHistory;
});

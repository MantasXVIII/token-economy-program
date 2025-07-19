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

  async function fetchHistoricalTargets() {
    try {
      const response = await fetch('/history/targets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        return await response.json();
      } else {
        console.warn('No historical targets found');
        return [];
      }
    } catch (error) {
      console.error('Error fetching historical targets:', error);
      return [];
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
    const cells = document.querySelectorAll('#grid-body .task-cell.completed');
    cells.forEach(cell => {
      const taskNum = cell.cellIndex - 1; // Subtract 1 for Day column
      if (taskNum >= 0 && taskNum < tasks.length) {
        total += tasks[taskNum].points;
      }
    });
    const targetValue = target.target || 200; // Use fetched target or default
    document.getElementById('weekly-progress').textContent = `Weekly Total: ${total} points | Total to Target: ${total} / ${targetValue} | Overall Total: ${overallTotal} points`;
  };

  async function updateOverallTotal() {
    let total = 0;
    const historyResponse = await fetch('/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (historyResponse.ok) {
      const history = await historyResponse.json();
      for (const { week } of history) {
        const weekData = await fetch(`/history/${week}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (weekData.ok) {
          const grid = await weekData.json();
          for (const day in grid) {
            tasks.forEach((task, index) => {
              const taskKey = `task${index + 1}`;
              if (grid[day][taskKey]) {
                total += task.points;
              }
            });
          }
        }
      }
    }
    overallTotal = total; // Update global variable
    updateWeeklyTotal(); // Reflect in UI
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
        await Promise.all([fetchTasks(), fetchTarget(), fetchHistoricalTargets(), updateOverallTotal()]); // Fetch all data
        generateTableHeader('grid-header');
        generateTableHeader('history-header');
        loadGrid();
        updateWeeklyTotal(); // Initialize total
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
          const completed = taskStates[taskKey] ? 'completed' : '';
          const disabled = role === 'viewer' ? 'pointer-events-none' : '';
          row.innerHTML += `<td class="task-cell ${completed} ${disabled}" data-day="${day}" data-task="${taskKey}">${task.points}</td>`;
        });
        tbody.appendChild(row);
      }
      // Add click handlers after rendering
      document.querySelectorAll('#grid-body .task-cell').forEach(cell => {
        cell.addEventListener('click', async () => {
          if (cell.classList.contains('pointer-events-none')) return;
          const day = cell.dataset.day;
          const task = cell.dataset.task;
          const currentValue = !cell.classList.contains('completed');
          console.log(`Toggling ${day}, ${task} to ${currentValue}`);
          const response = await updateTask('grid', day, task, currentValue);
          if (response.ok) {
            cell.classList.toggle('completed', currentValue);
            updateWeeklyTotal();
            await updateOverallTotal(); // Update overall total after grid change
          }
        });
      });
      updateWeeklyTotal(); // Update after loading
    } catch (error) {
      console.error('Error loading grid:', error);
    }
  }

  async function updateTask(endpoint, day, task, value) {
    try {
      console.log(`Updating ${endpoint} at ${day}, ${task} to ${value}`);
      const response = await fetch(`/${endpoint}${endpoint === 'history' ? '/' + document.getElementById('history-select').value : ''}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, task, value }),
      });
      return response;
    } catch (error) {
      console.error('Error updating task:', error);
      return new Response(null, { status: 500 });
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
          const completed = taskStates[taskKey] ? 'completed' : '';
          const disabled = role === 'viewer' ? 'pointer-events-none' : '';
          row.innerHTML += `<td class="task-cell ${completed} ${disabled}" data-day="${day}" data-task="${taskKey}">${task.points}</td>`;
        });
        tbody.appendChild(row);
      }
      // Add click handlers after rendering
      document.querySelectorAll('#history-body .task-cell').forEach(cell => {
        cell.addEventListener('click', async () => {
          if (cell.classList.contains('pointer-events-none')) return;
          const day = cell.dataset.day;
          const task = cell.dataset.task;
          const currentValue = !cell.classList.contains('completed');
          console.log(`Toggling ${day}, ${task} to ${currentValue}`);
          const response = await updateTask('history', day, task, currentValue);
          if (response.ok) {
            cell.classList.toggle('completed', currentValue);
            await updateOverallTotal(); // Update overall total after history change
          }
        });
      });
      await updateOverallTotal(); // Update overall total after loading history
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
    const historyResponse = await fetch('/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (historyResponse.ok) {
      const history = await historyResponse.json();
      for (const { week } of history) {
        const weekData = await fetch(`/history/${week}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (weekData.ok) {
          const grid = await weekData.json();
          for (const day in grid) {
            tasks.forEach((task, index) => {
              const taskKey = `task${index + 1}`;
              if (grid[day][taskKey]) {
                total += task.points;
              }
            });
          }
        }
      }
    }
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
        await updateOverallTotal(); // Update overall total after saving
      } else {
        alert('Failed to save history: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving history:', error);
      alert('Failed to save history due to an error');
    }
  }

  document.getElementById('target-reached-btn').addEventListener('click', async () => {
    overallTotal = 0;
    updateWeeklyTotal(); // Reset overall total in UI
    // Attempt to reset grid on server
    try {
      const response = await fetch('/grid/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        await loadGrid(); // Reload grid to reflect reset
        // Record achieved target
        const now = new Date().toISOString().split('T')[0];
        const targetData = { target: target.target, achieved: true, date: now };
        await fetch('/history/targets', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(targetData),
        });
        await fetchHistoricalTargets(); // Refresh historical targets
      }
    } catch (error) {
      console.error('Error resetting grid:', error);
    }
    alert('Target reached! Progress has been reset.');
  });

  // Bind the existing button
  document.getElementById('save-history-btn').onclick = saveHistory;

  window.login = login;
  window.updateTask = updateTask;
  window.viewHistory = viewHistory;
  window.loadHistory = loadHistory;
});

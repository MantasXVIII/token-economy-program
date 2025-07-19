document.addEventListener('DOMContentLoaded', async () => {
  let token = null;
  let role = null;
  let tasks = [];
  let target = { name: "Helldivers II PS5 Game", points: 10, image: "https://image.api.playstation.com/vulcan/ap/rnd/202309/0718/ca77865b4bc8a1ea110fbe1492f7de8f80234dd079fc181a.png" }; // Default from target.json

  async function fetchTasks() {
    try {
      const response = await fetch('/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      tasks = await response.json();
      console.log('Tasks loaded:', tasks);
      if (!tasks.length || !tasks[0].points) {
        console.error('Tasks data invalid or missing points:', tasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }

  async function fetchTarget() {
    try {
      const response = await fetch('/target');
      if (response.ok) {
        const data = await response.json();
        // Handle the single target object wrapped in an array
        target = Array.isArray(data) ? data[0] : data;
        console.log('Fetched target:', target); // Debug log
      } else {
        console.warn('Fetch target failed, using default:', target);
      }
      updateTargetDisplay();
    } catch (error) {
      console.error('Error fetching target:', error);
      updateTargetDisplay();
    }
  }

  function updateTargetDisplay() {
    document.getElementById('target-value').textContent = target.name || 'No Target';
    const targetImage = document.getElementById('target-image');
    if (target.image) {
      targetImage.src = target.image;
      targetImage.classList.remove('hidden');
    } else {
      targetImage.classList.add('hidden');
    }
  }

  function generateTableHeader(containerId) {
    const thead = document.getElementById(containerId);
    let headerHTML = '<tr>';
    headerHTML += '<th class="border p-2">Day</th>';
    tasks.forEach((task, index) => {
      const taskNum = index;
      headerHTML += `<th class="border p-2 task-header" data-task="${taskNum}">${task.name}</th>`;
    });
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;

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
      document.getElementById('task-description').classList.remove('hidden');
      document.querySelector('#task-description .bg-white').scrollTop = 0;
    } else {
      console.error('Invalid task index:', taskIndex, 'Available tasks:', tasks);
    }
  }

  document.getElementById('close-description').addEventListener('click', () => {
    document.getElementById('task-description').classList.add('hidden');
  });

  window.updateWeeklyTotal = function () {
    let weeklyTotal = 0;
    const cells = document.querySelectorAll('#grid-body .task-cell.completed');
    cells.forEach(cell => {
      const taskNum = cell.cellIndex - 1;
      if (taskNum >= 0 && taskNum < tasks.length && tasks[taskNum].points) {
        weeklyTotal += tasks[taskNum].points;
      } else {
        console.warn('Invalid task or missing points at index:', taskNum, 'Cell:', cell);
      }
    });

    // Calculate total points to target across all weeks
    let totalToTarget = weeklyTotal;
    fetch('/history', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.ok ? response.json() : [])
      .then(history => {
        const promises = history.map(({ week }) =>
          fetch(`/history/${week}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.ok ? res.json() : {})
        );
        Promise.all(promises).then(weeks => {
          weeks.forEach(grid => {
            if (grid && grid.target === target.points) { // Match target points
              const weekTotal = Object.values(grid).reduce((sum, day) => {
                return sum + Object.values(day).reduce((daySum, taskCompleted, index) => {
                  if (taskCompleted && tasks[index]?.points) {
                    daySum += tasks[index].points;
                  }
                  return daySum;
                }, 0);
              }, 0);
              totalToTarget += weekTotal;
            }
          });
          document.getElementById('weekly-progress').textContent = `Weekly Total: ${weeklyTotal} points | Total to Target: ${totalToTarget} / ${target.points || 10}`;
        });
      })
      .catch(error => console.error('Error fetching history:', error));
  };

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
      const data = await response.json();
      console.log('Login response data:', data);
      if (response.ok && data.token) {
        token = data.token;
        role = data.role;
        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await Promise.all([fetchTasks(), fetchTarget()]);
        generateTableHeader('grid-header');
        generateTableHeader('history-header');
        loadGrid();
        updateWeeklyTotal();
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
      if (!response.ok) throw new Error('Failed to load grid: ' + response.statusText);
      let grid = await response.json();
      console.log('Grid data:', grid); // Debug log
      // Ensure target is stored with grid if not present
      if (typeof grid.target === 'undefined') {
        const updateResponse = await fetch('/grid', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: 'target', task: 'target', value: target.points }),
        });
        if (!updateResponse.ok) throw new Error('Failed to update grid target: ' + updateResponse.statusText);
        grid = await updateResponse.json(); // Refresh grid data
      }
      const tbody = document.getElementById('grid-body');
      tbody.innerHTML = '';
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => {
        if (grid[day]) {
          const row = document.createElement('tr');
          row.innerHTML = `<td class="border p-2">${day}</td>`;
          tasks.forEach((task, index) => {
            const taskKey = `task${index + 1}`;
            const completed = grid[day][taskKey] ? 'completed' : '';
            const disabled = role === 'viewer' ? 'pointer-events-none' : '';
            row.innerHTML += `<td class="task-cell ${completed} ${disabled}" data-day="${day}" data-task="${taskKey}">${task.points || '0'}</td>`;
          });
          tbody.appendChild(row);
        }
      });
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
          }
        });
      });
      updateWeeklyTotal();
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
      if (!response.ok) throw new Error('Failed to update task: ' + response.statusText);
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
      let grid = await response.json();
      console.log('History grid data:', grid); // Debug log
      // Ensure target is stored with grid if not present
      if (typeof grid.target === 'undefined') {
        const updateResponse = await fetch(`/history/${week}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: 'target', task: 'target', value: target.points }),
        });
        if (!updateResponse.ok) throw new Error('Failed to update history target: ' + updateResponse.statusText);
        grid = await updateResponse.json(); // Refresh grid data
      }
      const tbody = document.getElementById('history-body');
      tbody.innerHTML = '';
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => {
        if (grid[day]) {
          const row = document.createElement('tr');
          row.innerHTML = `<td class="border p-2">${day}</td>`;
          tasks.forEach((task, index) => {
            const taskKey = `task${index + 1}`;
            const completed = grid[day][taskKey] ? 'completed' : '';
            const disabled = role === 'viewer' ? 'pointer-events-none' : '';
            row.innerHTML += `<td class="task-cell ${completed} ${disabled}" data-day="${day}" data-task="${taskKey}">${task.points || '0'}</td>`;
          });
          tbody.appendChild(row);
        }
      });
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
            updateWeeklyTotal(); // Update total after history edit
          }
        });
      });
      const container = document.getElementById('history-table-container');
      const table = container.querySelector('table');
      if (table) {
        container.style.minWidth = `${table.scrollWidth}px`;
      }
    } catch (error) {
      console.error('Error loading history data:', error);
    }
  }

  window.login = login;
  window.updateTask = updateTask;
  window.viewHistory = viewHistory;
  window.loadHistory = loadHistory;
});

"use strict";

/* =========================================================
   STATE  – the single source of truth. The DOM is rebuilt from it.
   ========================================================= */
var STORAGE_KEY = "todo.tasks.v1";
var FILTER_KEY = "todo.filter.v1";

var state = {
  tasks: [],        // { id, text, completed, createdAt }
  filter: "all",    // "all" | "active" | "completed"
  editingId: null   // id of the task being edited, or null
};

/* =========================================================
   PERSISTENCE  (window.localStorage, guarded with try/catch)
   ========================================================= */
function loadState() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      state.tasks = parsed.filter(function (t) {
        return t && typeof t.id === "string" && typeof t.text === "string";
      });
    }
    var savedFilter = window.localStorage.getItem(FILTER_KEY);
    if (savedFilter === "all" || savedFilter === "active" || savedFilter === "completed") {
      state.filter = savedFilter;
    }
  } catch (err) {
    state.tasks = [];
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    window.localStorage.setItem(FILTER_KEY, state.filter);
  } catch (err) {
    /* storage full or blocked: the app keeps working in memory */
  }
}

/* =========================================================
   ELEMENT REFERENCES
   ========================================================= */
var form = document.getElementById("add-form");
var input = document.getElementById("new-task");
var list = document.getElementById("task-list");
var emptyMsg = document.getElementById("empty");
var summary = document.getElementById("summary");
var filterBar = document.querySelector(".filters");
var clearBtn = document.getElementById("clear-completed");

/* =========================================================
   CRUD  – each function changes state, then calls update()
   ========================================================= */
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addTask(text) {
  var clean = text.trim();
  if (clean === "") {
    return;
  }
  state.tasks.unshift({
    id: createId(),
    text: clean,
    completed: false,
    createdAt: Date.now()
  });
  update();
}

function toggleTask(id) {
  state.tasks.forEach(function (task) {
    if (task.id === id) {
      task.completed = !task.completed;
    }
  });
  update();
}

function updateTask(id, text) {
  var clean = text.trim();
  if (clean === "") {
    deleteTask(id);   // saving an empty title removes the task
    return;
  }
  state.tasks.forEach(function (task) {
    if (task.id === id) {
      task.text = clean;
    }
  });
  state.editingId = null;
  update();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(function (task) {
    return task.id !== id;
  });
  if (state.editingId === id) {
    state.editingId = null;
  }
  update();
}

function clearCompleted() {
  state.tasks = state.tasks.filter(function (task) {
    return !task.completed;
  });
  update();
}

function setFilter(name) {
  state.filter = name;
  update();
}

/* =========================================================
   DERIVED DATA
   ========================================================= */
function visibleTasks() {
  return state.tasks.filter(function (task) {
    if (state.filter === "active") { return !task.completed; }
    if (state.filter === "completed") { return task.completed; }
    return true;
  });
}

function counts() {
  var done = 0;
  state.tasks.forEach(function (task) {
    if (task.completed) { done += 1; }
  });
  return { all: state.tasks.length, active: state.tasks.length - done, completed: done };
}

/* =========================================================
   RENDER  – builds elements with createElement (no innerHTML,
   so user text can never inject markup)
   ========================================================= */
function buildTaskItem(task) {
  var li = document.createElement("li");
  li.className = "task" + (task.completed ? " is-done" : "");
  li.dataset.id = task.id;

  if (state.editingId === task.id) {
    li.classList.add("is-editing");
    var editor = document.createElement("input");
    editor.type = "text";
    editor.className = "task__editor";
    editor.value = task.text;
    editor.maxLength = 200;
    editor.setAttribute("aria-label", "Edit task");
    editor.dataset.role = "editor";
    li.appendChild(editor);
    return li;
  }

  var check = document.createElement("input");
  check.type = "checkbox";
  check.className = "task__check";
  check.checked = task.completed;
  check.dataset.action = "toggle";
  check.setAttribute("aria-label", "Mark \u201c" + task.text + "\u201d as done");

  var label = document.createElement("span");
  label.className = "task__text";
  label.textContent = task.text;
  label.dataset.action = "edit";
  label.title = "Double-click to edit";

  var actions = document.createElement("div");
  actions.className = "task__actions";

  var editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.dataset.action = "edit";
  editBtn.textContent = "Edit";
  editBtn.setAttribute("aria-label", "Edit \u201c" + task.text + "\u201d");

  var delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "icon-btn icon-btn--danger";
  delBtn.dataset.action = "delete";
  delBtn.textContent = "Delete";
  delBtn.setAttribute("aria-label", "Delete \u201c" + task.text + "\u201d");

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  li.appendChild(check);
  li.appendChild(label);
  li.appendChild(actions);
  return li;
}

function render() {
  var shown = visibleTasks();
  var c = counts();

  list.textContent = "";
  var fragment = document.createDocumentFragment();
  shown.forEach(function (task) {
    fragment.appendChild(buildTaskItem(task));
  });
  list.appendChild(fragment);

  // filter buttons + counts
  filterBar.querySelectorAll(".filter").forEach(function (btn) {
    var active = btn.dataset.filter === state.filter;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  Object.keys(c).forEach(function (key) {
    filterBar.querySelector('[data-count="' + key + '"]').textContent = c[key];
  });

  // empty state
  if (shown.length === 0) {
    var messages = {
      all: "No tasks yet. Add your first one above.",
      active: "Nothing left to do.",
      completed: "No completed tasks yet."
    };
    emptyMsg.textContent = messages[state.filter];
    emptyMsg.hidden = false;
  } else {
    emptyMsg.hidden = true;
  }

  summary.textContent = c.active === 1 ? "1 task left" : c.active + " tasks left";
  clearBtn.disabled = c.completed === 0;

  // focus the editor after it is created
  var editor = list.querySelector('[data-role="editor"]');
  if (editor) {
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
}

function update() {
  saveState();
  render();
}

/* =========================================================
   EVENTS  – one delegated listener on the list handles every task
   ========================================================= */
form.addEventListener("submit", function (event) {
  event.preventDefault();
  addTask(input.value);
  input.value = "";
  input.focus();
});

list.addEventListener("click", function (event) {
  var target = event.target.closest("[data-action]");
  var item = event.target.closest(".task");
  if (!target || !item || !list.contains(item)) {
    return;
  }
  var id = item.dataset.id;
  var action = target.dataset.action;

  // a click on the text label should not start editing; double-click does
  if (target.classList.contains("task__text")) {
    return;
  }
  if (action === "toggle") {
    toggleTask(id);
  } else if (action === "delete") {
    deleteTask(id);
  } else if (action === "edit") {
    state.editingId = id;
    render();
  }
});

list.addEventListener("dblclick", function (event) {
  var label = event.target.closest(".task__text");
  var item = event.target.closest(".task");
  if (label && item) {
    state.editingId = item.dataset.id;
    render();
  }
});

list.addEventListener("keydown", function (event) {
  if (event.target.dataset.role !== "editor") {
    return;
  }
  var id = event.target.closest(".task").dataset.id;
  if (event.key === "Enter") {
    updateTask(id, event.target.value);
  } else if (event.key === "Escape") {
    state.editingId = null;
    render();
  }
});

// focusout bubbles, so one listener also covers "click away to save"
list.addEventListener("focusout", function (event) {
  if (event.target.dataset.role !== "editor" || state.editingId === null) {
    return;
  }
  updateTask(event.target.closest(".task").dataset.id, event.target.value);
});

filterBar.addEventListener("click", function (event) {
  var btn = event.target.closest(".filter");
  if (btn) {
    setFilter(btn.dataset.filter);
  }
});

clearBtn.addEventListener("click", clearCompleted);

// keep several open tabs in sync
window.addEventListener("storage", function (event) {
  if (event.key === STORAGE_KEY) {
    loadState();
    render();
  }
});

/* =========================================================
   INIT
   ========================================================= */
loadState();
render();

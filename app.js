// تهيئة Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// متغيرات عامة
let tasks = [];
let notificationTimer;
let currentUser = null;
let isOnline = navigator.onLine;

// التحقق من حالة الاتصال بالإنترنت
window.addEventListener('online', () => {
    isOnline = true;
    syncTasks();
    document.getElementById('connectionStatus').textContent = 'متصل';
    document.getElementById('connectionStatus').style.color = '#4CAF50';
});

window.addEventListener('offline', () => {
    isOnline = false;
    document.getElementById('connectionStatus').textContent = 'غير متصل';
    document.getElementById('connectionStatus').style.color = '#F44336';
});

// التحقق من حالة تسجيل الدخول عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تعيين حالة الاتصال الأولية
    document.getElementById('connectionStatus').textContent = isOnline ? 'متصل' : 'غير متصل';
    document.getElementById('connectionStatus').style.color = isOnline ? '#4CAF50' : '#F44336';
    
    // التحقق من حالة تسجيل الدخول
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = {
                username: user.email.split('@')[0],
                id: user.uid
            };
            showApp();
        } else {
            showLoginForm();
        }
    });
    
    // إضافة مهمة عند الضغط على Enter
    document.getElementById('taskInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    
    // إضافة استجابة للضغط على Enter في نماذج تسجيل الدخول وإنشاء حساب
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    document.getElementById('confirmPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            register();
        }
    });
});

// عرض نموذج تسجيل الدخول
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

// عرض نموذج إنشاء حساب
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

// تسجيل الدخول
function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const email = username + '@taskmanager.com'; // استخدام بريد إلكتروني وهمي
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('الرجاء إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    
    // تسجيل الدخول باستخدام Firebase
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // مسح حقول النموذج
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
        })
        .catch((error) => {
            alert('خطأ في تسجيل الدخول: ' + error.message);
        });
}

// إنشاء حساب جديد
function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = username + '@taskmanager.com'; // استخدام بريد إلكتروني وهمي
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!username || !password) {
        alert('الرجاء إدخال اسم المستخدم وكلمة المرور');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
        return;
    }
    
    // إنشاء حساب جديد باستخدام Firebase
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // مسح حقول النموذج
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        })
        .catch((error) => {
            alert('خطأ في إنشاء الحساب: ' + error.message);
        });
}

// تسجيل الخروج
function logout() {
    if (notificationTimer) {
        clearInterval(notificationTimer);
        notificationTimer = null;
    }
    
    auth.signOut().then(() => {
        currentUser = null;
        tasks = [];
        showLoginForm();
    }).catch((error) => {
        console.error('خطأ في تسجيل الخروج:', error);
    });
}

// عرض التطبيق بعد تسجيل الدخول
function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userWelcome').textContent = `مرحبًا، ${currentUser.username}`;
    
    // تحميل مهام المستخدم
    loadTasks();
    
    requestNotificationPermission();
    
    // بدء التحقق من الإشعارات كل دقيقة
    if (notificationTimer) {
        clearInterval(notificationTimer);
    }
    notificationTimer = setInterval(checkTaskNotifications, 60000);
    // تحقق فوري عند تحميل الصفحة
    checkTaskNotifications();
}

// طلب إذن الإشعارات
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

// تحميل المهام من Firebase
function loadTasks() {
    if (!currentUser) return;
    
    if (isOnline) {
        // تحميل المهام من Firebase
        database.ref('tasks/' + currentUser.id).once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                tasks = data ? Object.values(data) : [];
                renderTasks();
                updateStats();
            })
            .catch((error) => {
                console.error('خطأ في تحميل المهام من Firebase:', error);
                // في حالة الفشل، استخدم التخزين المحلي
                loadTasksFromLocalStorage();
            });
    } else {
        // إذا كان غير متصل، استخدم التخزين المحلي
        loadTasksFromLocalStorage();
    }
}

// تحميل المهام من التخزين المحلي
function loadTasksFromLocalStorage() {
    try {
        if (currentUser) {
            const userTasks = localStorage.getItem(`tasks_${currentUser.id}`);
            if (userTasks) {
                tasks = JSON.parse(userTasks);
            } else {
                tasks = [];
            }
            renderTasks();
            updateStats();
        }
    } catch (e) {
        console.error('خطأ في تحميل المهام من التخزين المحلي:', e);
        tasks = [];
        renderTasks();
        updateStats();
    }
}

// حفظ المهام
function saveTasks() {
    if (!currentUser) return;
    
    // حفظ في التخزين المحلي دائمًا
    try {
        localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
    } catch (e) {
        console.error('خطأ في حفظ المهام في التخزين المحلي:', e);
    }
    
    // إذا كان متصلاً بالإنترنت، حفظ في Firebase أيضًا
    if (isOnline) {
        syncTasks();
    }
}

// مزامنة المهام مع Firebase
function syncTasks() {
    if (!currentUser || !isOnline) return;
    
    // تحويل المصفوفة إلى كائن مع معرفات
    const tasksObject = {};
    tasks.forEach(task => {
        tasksObject[task.id] = task;
    });
    
    // حفظ في Firebase
    database.ref('tasks/' + currentUser.id).set(tasksObject)
        .catch((error) => {
            console.error('خطأ في مزامنة المهام مع Firebase:', error);
        });
}

// إضافة مهمة جديدة
function addTask() {
    const taskInput = document.getElementById('taskInput');
    const taskDateTime = document.getElementById('taskDateTime');
    const taskText = taskInput.value.trim();
    const dueDateTime = taskDateTime.value ? new Date(taskDateTime.value).toISOString() : null;
    
    if (taskText) {
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false,
            dateAdded: new Date().toISOString(),
            dueDateTime: dueDateTime,
            notified: false
        };
        
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        updateStats();
        
        // مسح حقول الإدخال
        taskInput.value = '';
        taskDateTime.value = '';
    } else {
        alert('الرجاء إدخال نص للمهمة');
    }
}

// عرض المهام في القائمة
function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        
        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        if (task.completed) {
            taskText.classList.add('completed');
        }
        taskText.textContent = task.text;
        
        taskContent.appendChild(taskText);
        
        // إضافة تاريخ الاستحقاق إذا كان موجودًا
        if (task.dueDateTime) {
            const dueDate = new Date(task.dueDateTime);
            const now = new Date();
            
            const taskDue = document.createElement('div');
            taskDue.className = 'task-due';
            if (dueDate < now && !task.completed) {
                taskDue.classList.add('overdue');
            }
            
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            };
            taskDue.textContent = `موعد التنفيذ: ${dueDate.toLocaleDateString('ar-SA', options)}`;
            
            taskContent.appendChild(taskDue);
        }
        
        const taskActions = document.createElement('div');
        taskActions.className = 'task-actions';
        
        // زر إكمال المهمة
        const completeBtn = document.createElement('button');
        completeBtn.className = 'complete-btn';
        completeBtn.textContent = task.completed ? 'تراجع' : 'إكمال';
        completeBtn.onclick = function() {
            toggleTaskComplete(task.id);
        };
        
        // زر تعديل المهمة
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'تعديل';
        editBtn.onclick = function() {
            editTask(task.id);
        };
        
        // زر حذف المهمة
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'حذف';
        deleteBtn.onclick = function() {
            deleteTask(task.id);
        };
        
        taskActions.appendChild(completeBtn);
        taskActions.appendChild(editBtn);
        taskActions.appendChild(deleteBtn);
        
        li.appendChild(taskContent);
        li.appendChild(taskActions);
        
        taskList.appendChild(li);
    });
}

// تبديل حالة إكمال المهمة
function toggleTaskComplete(taskId) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
        tasks[taskIndex].completed = !tasks[taskIndex].completed;
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// تعديل نص المهمة
function editTask(taskId) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
        const task = tasks[taskIndex];
        const newText = prompt('تعديل المهمة:', task.text);
        
        if (newText !== null && newText.trim() !== '') {
            tasks[taskIndex].text = newText.trim();
            
            // تعديل التاريخ والوقت
            let dueDateTime = null;
            if (task.dueDateTime) {
                const currentDueDate = new Date(task.dueDateTime);
                const formattedDate = currentDueDate.toISOString().slice(0, 16);
                const newDateTime = prompt('تعديل التاريخ والوقت (اترك فارغًا للإلغاء):', formattedDate);
                
                if (newDateTime) {
                    dueDateTime = new Date(newDateTime).toISOString();
                }
            } else {
                const addDateTime = confirm('هل تريد إضافة تاريخ ووقت للمهمة؟');
                if (addDateTime) {
                    const now = new Date();
                    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    const newDateTime = prompt('أدخل التاريخ والوقت:', localDateTime);
                    
                    if (newDateTime) {
                        dueDateTime = new Date(newDateTime).toISOString();
                    }
                }
            }
            
            tasks[taskIndex].dueDateTime = dueDateTime;
            tasks[taskIndex].notified = false; // إعادة تعيين حالة الإشعار
            
            saveTasks();
            renderTasks();
        }
    }
}

// حذف مهمة
function deleteTask(taskId) {
    if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
        tasks = tasks.filter(task => task.id !== taskId);
        saveTasks();
        renderTasks();
        updateStats();
    }
}

// تحقق من المهام التي يجب إرسال إشعارات لها
function checkTaskNotifications() {
    const now = new Date();
    
    tasks.forEach(task => {
        if (task.dueDateTime && !task.completed && !task.notified) {
            const dueDate = new Date(task.dueDateTime);
            
            // إذا حان وقت المهمة (أو تجاوزناه بأقل من دقيقة)
            if (dueDate <= now && (now - dueDate) < 60000) {
                sendNotification(task);
                
                // تحديث حالة الإشعار للمهمة
                const taskIndex = tasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    tasks[taskIndex].notified = true;
                    saveTasks();
                }
            }
        }
    });
}

// إرسال إشعار للمهمة
function sendNotification(task) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('تذكير بمهمة', {
            body: `حان وقت البدء في: ${task.text}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/1950/1950715.png'
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                sendNotification(task);
            }
        });
    }
}

// تحديث إحصائيات المهام
function updateStats() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.completed).length;
    
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
}
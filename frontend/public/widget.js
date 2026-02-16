(function() {
  console.log('LexAI: Script iniciado - ' + new Date().toISOString());

  // =====================================================
  // VERSIÓN OPTIMIZADA - Widget aparece INMEDIATAMENTE
  // Usuario y curso se cargan DESPUÉS en background
  // =====================================================

  // Variables que se llenarán después
  var teachableUser = { userName: '', userEmail: '', userId: '' };
  var currentCourse = '';
  var cachedCourseName = '';
  var courseIdentifier = null;

  // Variables para tracking de lecciones
  var currentLessonName = '';
  var previousLessonName = '';
  var lastUrl = window.location.href;

  // Mapeo de slugs conocidos a nombres de cursos
  var slugToNameMapping = {
    'instituciones-penitenciarias': 'Instituciones Penitenciarias',
    'institucionespenitenciarias': 'Instituciones Penitenciarias',
    'iipp': 'Instituciones Penitenciarias',
    'gestion-procesal': 'Gestión Procesal',
    'tramitacion-procesal': 'Tramitación Procesal',
    'auxilio-judicial': 'Auxilio Judicial',
    'constitucion-espanola': 'Constitución Española',
    'leyes-de-igualdad': 'Leyes de Igualdad',
    'ley-39-2015': 'Procedimiento Administrativo',
    'casos-practicos': 'Casos Prácticos',
    'oposiciones-justicia': 'Oposiciones de Justicia',
    // Nuevos cursos
    'derecho-administrativo-ii2': 'Derecho Administrativo II',
    'deontologia-juridica': 'Deontología Jurídica',
    'untitled-2-1': 'Curso de Derecho'
  };

  // Verificar si es un ID numérico
  function isNumericId(str) {
    return /^\d+$/.test(str);
  }

  // Extraer ID de la lección de la URL
  function getLectureIdFromUrl() {
    var match = window.location.href.match(/\/lectures\/(\d+)/);
    return match ? match[1] : null;
  }

  // Extraer nombre de la lección actual de la página
  function getCurrentLessonName() {
    // Intentar obtener el título de la lección de Teachable
    var selectors = [
      '.lecture-left h2',
      '.lecture-title',
      '.section-title h2',
      'h2.section-title',
      '.lecture-header h2',
      '.course-mainbar h2',
      '.lecture-content h2',
      'h1'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim()) {
        var text = el.textContent.trim();
        // Evitar textos muy largos o que sean del menú
        if (text.length > 5 && text.length < 200) {
          return text;
        }
      }
    }

    return '';
  }

  // Variable para el ID de la última lección
  var lastLectureId = null;

  // Detectar cambio de lección comparando IDs de URL
  function checkLessonChange() {
    var currentLectureId = getLectureIdFromUrl();

    // Si no estamos en una página de lección, ignorar
    if (!currentLectureId) return;

    // Si es la primera vez, solo guardar el ID
    if (lastLectureId === null) {
      lastLectureId = currentLectureId;
      currentLessonName = getCurrentLessonName();
      console.log('LexAI: Lección inicial (ID ' + currentLectureId + '):', currentLessonName);
      return;
    }

    // Si el ID cambió, hubo navegación a otra lección
    if (currentLectureId !== lastLectureId) {
      console.log('LexAI: ¡Cambio de lección detectado! ID: ' + lastLectureId + ' -> ' + currentLectureId);

      // Guardar la lección anterior
      previousLessonName = currentLessonName;

      // Actualizar el ID
      lastLectureId = currentLectureId;

      // Esperar a que la página cargue para obtener el nuevo nombre
      setTimeout(function() {
        currentLessonName = getCurrentLessonName();

        console.log('LexAI: Lección anterior:', previousLessonName);
        console.log('LexAI: Lección actual:', currentLessonName);

        // Si hay lección anterior, mostrar mensaje de repaso
        if (previousLessonName) {
          // Generar UN solo mensaje aleatorio para nubecita y chat
          var normalizedName = normalizeLessonName(previousLessonName);
          var shortName = normalizedName.length > 25 ? normalizedName.substring(0, 25) + '...' : normalizedName;
          var userName = teachableUser.userName || '';

          // Elegir una plantilla aleatoria una sola vez
          var greetingTemplate = REVIEW_GREETINGS[Math.floor(Math.random() * REVIEW_GREETINGS.length)];

          // Nubecita: con nombre truncado
          var bubbleMessage = userName
            ? greetingTemplate.replace('{nombre}', userName).replace('{leccion}', shortName)
            : '¿Repasamos <strong>' + shortName + '</strong>?';
          updateSmallMessageWithHtml(bubbleMessage);

          // Chat: misma plantilla pero con nombre COMPLETO
          var chatMessage = userName
            ? greetingTemplate.replace('{nombre}', userName).replace('{leccion}', normalizedName)
            : '¿Repasamos <strong>' + normalizedName + '</strong>?';

          // Enviar al iframe con el mensaje para el chat
          updateIframeWithData({
            type: 'LEXAI_LESSON_CHANGE',
            previousLesson: previousLessonName,
            currentLesson: currentLessonName,
            reviewMessage: chatMessage
          });
        }
      }, 2000);
    }
  }

  // Iniciar detección de cambios de URL
  function startLessonChangeDetection() {
    console.log('LexAI: Iniciando detección de cambios de lección...');

    // Verificar inmediatamente
    checkLessonChange();

    // Polling cada 1 segundo para detectar cambios de URL (más frecuente)
    setInterval(checkLessonChange, 1000);

    // También escuchar popstate para navegación con botones atrás/adelante
    window.addEventListener('popstate', function() {
      setTimeout(checkLessonChange, 500);
    });
  }

  // Extraer ID o slug del curso de la URL (rápido, solo regex)
  function getCourseFromUrl() {
    var url = window.location.href;
    var courseMatch = url.match(/\/courses\/(?:enrolled\/)?([^\/\?]+)/);
    if (courseMatch && courseMatch[1]) {
      return courseMatch[1];
    }
    return null;
  }

  // Obtener datos del usuario de Teachable (puede ser lento)
  function getTeachableUser() {
    var userName = '';
    var userEmail = '';
    var userId = '';

    try {
      if (typeof currentUser === 'function') {
        var user = currentUser();
        userId = user.id || '';
        userEmail = user.email || '';
        userName = user.name || user.username || user.first_name || '';
      }
    } catch (e) {
      console.log('LexAI: No se pudo obtener datos del usuario');
    }

    return { userName: userName, userEmail: userEmail, userId: userId };
  }

  // Obtener nombre del curso desde la API (async con timeout corto)
  function fetchCourseNameFromAPI(courseId) {
    return new Promise(function(resolve) {
      var timeoutId = setTimeout(function() { resolve(''); }, 2000);

      fetch('https://lexia-backend.vercel.app/api/get-course-name?courseId=' + courseId)
        .then(function(response) { return response.json(); })
        .then(function(data) {
          clearTimeout(timeoutId);
          resolve(data.courseName || '');
        })
        .catch(function() {
          clearTimeout(timeoutId);
          resolve('');
        });
    });
  }

  // Función para auto-abrir el chat
  function autoOpenChat() {
    var container = document.querySelector('.lexai-widget-container');
    var button = document.querySelector('.lexai-widget-button');
    var smallMessage = document.querySelector('.lexai-small-message');

    if (container && button) {
      setTimeout(function() {
        container.classList.add('active');
        button.classList.add('active');
        button.classList.remove('pulse');
        if (smallMessage) smallMessage.classList.add('hidden');
      }, 1000);
    }
  }

  // Función para actualizar el iframe con datos de usuario/curso via postMessage
  function updateIframeWithData(data) {
    var iframe = document.querySelector('.lexai-widget-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(data, '*');
    }
  }

  // Construir URL del iframe - BÁSICA sin parámetros
  // Los parámetros se enviarán via postMessage después
  function buildIframeUrl() {
    return 'https://lexia-chatbot.vercel.app/embed';
  }

  // Configuración del widget
  const WIDGET_CONFIG = {
    position: 'bottom-right',
    primaryColor: '#64c27b',
    iframeUrl: buildIframeUrl(),
    buttonText: '💬 Pregunta a LexAI',
    iconUrl: 'https://lexia-chatbot.vercel.app/logobuho.png'
  };

  // Estilos CSS del widget
  const styles = `
    .lexai-widget-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: transparent;
      box-shadow: none;
      cursor: pointer;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      border: none;
      padding: 0;
    }

    .lexai-widget-button:hover {
      transform: scale(1.1);
    }

    .lexai-widget-button.active {
      background: transparent;
    }

    .lexai-widget-button svg {
      width: 42px;
      height: 42px;
    }

    .lexai-widget-button img {
      width: 90px;
      height: 90px;
      object-fit: contain;
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.5)) drop-shadow(0 0 15px rgba(255, 200, 0, 0.3));
      transition: filter 0.3s ease;
    }

    .lexai-widget-button:hover img {
      filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.7)) drop-shadow(0 0 22px rgba(255, 200, 0, 0.5));
    }

    .lexai-small-message {
      position: fixed;
      bottom: 120px;
      right: 25px;
      background: white;
      color: #2c3e50;
      padding: 6px 10px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
      font-size: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 9997;
      transition: all 0.3s ease;
      opacity: 1;
      pointer-events: none;
      max-width: 130px;
      text-align: center;
      line-height: 1.4;
      transform: translateX(-5px);
    }

    .lexai-small-message.hidden {
      opacity: 0;
      transform: translateX(-5px) translateY(10px);
    }

    .lexai-small-message strong {
      color: ${WIDGET_CONFIG.primaryColor};
      font-weight: 600;
    }

    .lexai-widget-tooltip {
      display: none;
    }

    .lexai-widget-container {
      position: fixed;
      bottom: 120px;
      right: 20px;
      width: 380px;
      height: 600px;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s ease;
      transform-origin: bottom right;
    }

    .lexai-widget-container.active {
      display: flex;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .lexai-widget-header {
      background: ${WIDGET_CONFIG.primaryColor};
      color: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .lexai-widget-title {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lexai-widget-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s ease;
    }

    .lexai-widget-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .lexai-widget-iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      font-size: 16px; /* Tamaño base más grande */
    }

    /* Responsive para móviles */
    @media (max-width: 768px) {
      .lexai-widget-container {
        width: calc(100vw - 20px);
        height: calc(100vh - 100px);
        left: 10px;
        right: 10px;
        bottom: 80px;
        max-height: none;
      }

      .lexai-widget-button {
        bottom: 15px;
        right: 15px;
        width: 56px;
        height: 56px;
      }

      .lexai-widget-button img {
        width: 56px;
        height: 56px;
      }

      .lexai-small-message {
        bottom: 80px;
        right: 8px;
        font-size: 11px;
        padding: 8px 10px;
        max-width: 150px;
        transform: translateX(0);
      }
    }

    /* Animación de pulso para llamar la atención */
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(100, 194, 123, 0.6);
      }
      70% {
        box-shadow: 0 0 0 15px rgba(100, 194, 123, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(100, 194, 123, 0);
      }
    }

    .lexai-widget-button.pulse {
      animation: pulse 2s infinite;
    }

    /* Indicador de mensajes nuevos */
    .lexai-widget-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #FF4444;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  `;

  // Inyectar estilos
  function injectStyles() {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  // Crear el botón flotante
  function createFloatingButton() {
    const button = document.createElement('button');
    button.className = 'lexai-widget-button pulse';
    button.innerHTML = `
      <img src="${WIDGET_CONFIG.iconUrl}" alt="LexAI" />
    `;
    button.setAttribute('aria-label', 'Abrir chat de LexAI');
    return button;
  }

  // Crear el mensaje pequeño (vacío inicialmente, se llena cuando se detecta el curso)
  function createSmallMessage() {
    const message = document.createElement('div');
    message.className = 'lexai-small-message hidden';
    message.innerHTML = '';
    return message;
  }

  // Repertorio de saludos de bienvenida al curso
  var COURSE_GREETINGS = [
    '¡Qué bueno verte {nombre}! ¿Quieres darle caña a <strong>{curso}</strong>?',
    '¡Ey {nombre}! ¿Listo para machacar <strong>{curso}</strong>?',
    '¡Buenas {nombre}! ¿Empezamos con <strong>{curso}</strong>?',
    '¡Dale {nombre}! ¿Vamos con <strong>{curso}</strong>?',
    '¡Venga {nombre}! ¿Atacamos <strong>{curso}</strong>?',
    '¡Ya estamos aquí {nombre}! ¿Estudiamos <strong>{curso}</strong>?',
    '¿Qué tal {nombre}? ¿Vamos con <strong>{curso}</strong>?',
    '¡A por ello {nombre}! ¿Estudiamos <strong>{curso}</strong>?',
    '¡Vamos allá {nombre}! ¿Repasamos <strong>{curso}</strong>?',
    '¡Tú puedes {nombre}! ¿Empezamos <strong>{curso}</strong>?',
    '¡Ánimo {nombre}! ¿Le damos caña a <strong>{curso}</strong>?',
    '¡Por aquí andamos {nombre}! ¿Vemos <strong>{curso}</strong>?',
    '¡Cuánto tiempo {nombre}! ¿Seguimos con <strong>{curso}</strong>?',
    '¡Aquí estoy {nombre}! ¿Te ayudo con <strong>{curso}</strong>?',
    '¡Me alegro de verte {nombre}! ¿Repasamos <strong>{curso}</strong>?'
  ];

  // Capitalizar primera letra del nombre
  function capitalizeFirstName(name) {
    if (!name) return '';
    var firstName = name.split(' ')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  // Obtener un saludo de curso aleatorio
  function getRandomCourseGreeting(userName, courseName) {
    var greeting = COURSE_GREETINGS[Math.floor(Math.random() * COURSE_GREETINGS.length)];
    var formattedName = capitalizeFirstName(userName);
    return greeting.replace('{nombre}', formattedName).replace('{curso}', courseName);
  }

  // Actualizar el mensaje pequeño con el nombre del curso
  function updateSmallMessage(courseName) {
    var smallMessage = document.querySelector('.lexai-small-message');
    if (smallMessage && courseName) {
      var userName = teachableUser.userName || '';
      if (userName) {
        smallMessage.innerHTML = getRandomCourseGreeting(userName, courseName);
      } else {
        smallMessage.innerHTML = '¿Quieres darle caña a <strong>' + courseName + '</strong>?';
      }
      smallMessage.classList.remove('hidden');
    }
  }

  // Normalizar nombre de lección (de MAYÚSCULAS a Normal Case)
  function normalizeLessonName(name) {
    if (!name) return '';
    // Convertir a minúsculas y luego capitalizar primera letra de cada palabra
    return name.toLowerCase().replace(/(?:^|\s)\S/g, function(letter) {
      return letter.toUpperCase();
    });
  }

  // Timer para el mensaje "Te estoy esperando"
  var waitingMessageTimer = null;

  // Repertorio de saludos al estilo español
  var REVIEW_GREETINGS = [
    '¿Qué pasa {nombre}? ¿Repasamos <strong>{leccion}</strong>?',
    '¡Ey {nombre}! ¿Le damos caña a <strong>{leccion}</strong>?',
    '¡Muy buenas {nombre}! ¿Echamos un ojo a <strong>{leccion}</strong>?',
    '¡Venga {nombre}! ¿Repasamos <strong>{leccion}</strong>?',
    '¿Cómo lo llevas {nombre}? ¿Revisamos <strong>{leccion}</strong>?',
    '¡{nombre}! ¿Machacamos <strong>{leccion}</strong>?',
    '¡Dale {nombre}! ¿Atacamos <strong>{leccion}</strong>?',
    '¡Ánimo {nombre}! ¿Repasamos <strong>{leccion}</strong>?',
    '¡Vamos {nombre}! ¿Le damos un repaso a <strong>{leccion}</strong>?',
    '¡A por ello {nombre}! ¿Revisamos <strong>{leccion}</strong>?',
    '¡Tú puedes {nombre}! ¿Repasamos <strong>{leccion}</strong>?',
    'Oye {nombre}, ¿le damos otra vuelta a <strong>{leccion}</strong>?',
    '¡Buenas {nombre}! ¿Dudas con <strong>{leccion}</strong>?',
    '¿Todo bien {nombre}? ¿Vemos <strong>{leccion}</strong> juntos?',
    '¡Aquí estoy {nombre}! ¿Repasamos <strong>{leccion}</strong>?'
  ];

  // Obtener un saludo aleatorio
  function getRandomGreeting(userName, lessonName) {
    var greeting = REVIEW_GREETINGS[Math.floor(Math.random() * REVIEW_GREETINGS.length)];
    return greeting.replace('{nombre}', userName).replace('{leccion}', lessonName);
  }

  // Actualizar el mensaje pequeño con HTML ya generado
  function updateSmallMessageWithHtml(html) {
    var smallMessage = document.querySelector('.lexai-small-message');
    if (smallMessage && html) {
      // Cancelar timer anterior si existe
      if (waitingMessageTimer) {
        clearTimeout(waitingMessageTimer);
        waitingMessageTimer = null;
      }

      smallMessage.innerHTML = html;
      smallMessage.classList.remove('hidden');

      // Después de 30 segundos, mostrar mensaje de espera
      waitingMessageTimer = setTimeout(function() {
        smallMessage.innerHTML = 'Te estoy esperando 👀';
        waitingMessageTimer = null;
      }, 30000);
    }
  }

  // Función global para ajustar el tamaño de fuente del iframe
  window.adjustIframeFont = function(iframe) {
    try {
      // Esperar un poco para que el contenido cargue
      setTimeout(() => {
        const message = {
          type: 'WIDGET_FONT_SIZE',
          fontSize: '16px'
        };
        iframe.contentWindow.postMessage(message, '*');
      }, 1000);
    } catch (e) {
      // Si hay problemas de cors, ignorar silenciosamente
      console.log('Could not adjust iframe font size due to CORS restrictions');
    }
  };

  // Crear el contenedor del chat
  function createChatContainer() {
    const container = document.createElement('div');
    container.className = 'lexai-widget-container';
    container.innerHTML = `
      <div class="lexai-widget-header">
        <div class="lexai-widget-title">
          <img src="${WIDGET_CONFIG.iconUrl}" alt="LexAI" style="width: 30px; height: 30px;" />
          <span>LexAI - Asistente Legal</span>
        </div>
        <button class="lexai-widget-close" aria-label="Cerrar chat">×</button>
      </div>
      <iframe 
        class="lexai-widget-iframe"
        src="${WIDGET_CONFIG.iframeUrl}"
        title="LexAI Chat"
        allow="clipboard-write"
        onload="adjustIframeFont(this)">
      </iframe>
    `;
    return container;
  }

  // Inicializar el widget
  function initWidget() {
    console.log('LexAI: initWidget llamado - ' + new Date().toISOString());

    // Evitar inicialización múltiple
    if (document.querySelector('.lexai-widget-button')) {
      console.log('LexAI: Widget ya existe, saltando');
      return;
    }

    injectStyles();

    const button = createFloatingButton();
    const container = createChatContainer();
    const smallMessage = createSmallMessage();

    document.body.appendChild(button);
    document.body.appendChild(container);
    document.body.appendChild(smallMessage);

    console.log('LexAI: Botón inyectado en DOM - ' + new Date().toISOString());

    // Event listeners
    button.addEventListener('click', function() {
      const isActive = container.classList.contains('active');

      if (isActive) {
        container.classList.remove('active');
        button.classList.remove('active');
        button.classList.add('pulse');
        // Mostrar el mensaje pequeño cuando se cierra el chat
        smallMessage.classList.remove('hidden');
      } else {
        container.classList.add('active');
        button.classList.add('active');
        button.classList.remove('pulse');
        // Ocultar el mensaje pequeño cuando se abre el chat
        smallMessage.classList.add('hidden');
        // Notificar al iframe que se abrió el chat para hacer scroll
        setTimeout(function() {
          updateIframeWithData({ type: 'LEXAI_CHAT_OPENED' });
        }, 300);
      }
    });

    // Cerrar con el botón X
    const closeButton = container.querySelector('.lexai-widget-close');
    closeButton.addEventListener('click', function() {
      container.classList.remove('active');
      button.classList.remove('active');
      button.classList.add('pulse');
      // Mostrar el mensaje pequeño cuando se cierra el chat
      smallMessage.classList.remove('hidden');
    });

    // Cerrar con ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && container.classList.contains('active')) {
        container.classList.remove('active');
        button.classList.remove('active');
        button.classList.add('pulse');
        // Mostrar el mensaje pequeño cuando se cierra el chat
        smallMessage.classList.remove('hidden');
      }
    });

    // Si no hay curso en la URL, mostrar badge después de 3 segundos
    // (Si hay curso, el auto-open se maneja arriba)
    if (!courseIdentifier) {
      setTimeout(function() {
        if (!container.classList.contains('active')) {
          // Agregar una notificación badge opcional
          const badge = document.createElement('span');
          badge.className = 'lexai-widget-badge';
          badge.textContent = '1';
          button.appendChild(badge);

          // Quitar el badge cuando se abra
          button.addEventListener('click', function() {
            if (badge && badge.parentNode) {
              badge.remove();
            }
          }, { once: true });
        }
      }, 3000);
    }
  }

  // INYECTAR INMEDIATAMENTE - No esperar a DOMContentLoaded
  // Esto es crítico para que el botón aparezca rápido en páginas pesadas como Teachable
  function tryInit() {
    // Si body existe, inyectar inmediatamente
    if (document.body) {
      initWidget();
      setTimeout(loadUserAndCourseData, 100);
      // Iniciar detección de cambios de lección
      setTimeout(startLessonChangeDetection, 3000);
    } else {
      // Si body no existe aún, intentar de nuevo muy pronto
      setTimeout(tryInit, 10);
    }
  }

  // Intentar inyectar ahora mismo
  tryInit();

  // Cargar usuario y curso EN BACKGROUND después de que el widget aparezca
  function loadUserAndCourseData() {
    console.log('LexAI: Cargando datos de usuario y curso en background...');

    // 1. Obtener usuario de Teachable
    try {
      teachableUser = getTeachableUser();
      if (teachableUser.userName || teachableUser.userId) {
        console.log('LexAI: Usuario detectado:', teachableUser.userName || teachableUser.userId);
      }
    } catch (e) {
      console.log('LexAI: Error obteniendo usuario');
    }

    // 2. Detectar curso de la URL
    courseIdentifier = getCourseFromUrl();

    // 3. Enviar datos de usuario al iframe después de que cargue (ANTES del curso)
    setTimeout(function() {
      if (teachableUser.userName || teachableUser.userId) {
        console.log('LexAI: Enviando datos de usuario al iframe');
        updateIframeWithData({
          type: 'LEXAI_UPDATE_USER',
          userName: teachableUser.userName,
          userEmail: teachableUser.userEmail,
          userId: teachableUser.userId
        });
      }
    }, 800); // Enviar usuario ANTES que el curso

    if (courseIdentifier) {
      console.log('LexAI: Course identifier:', courseIdentifier);

      // Si es un slug conocido, usar el mapeo
      if (!isNumericId(courseIdentifier) && slugToNameMapping[courseIdentifier.toLowerCase()]) {
        cachedCourseName = slugToNameMapping[courseIdentifier.toLowerCase()];
        console.log('LexAI: Curso detectado (slug):', cachedCourseName);

        // Actualizar el mensaje pequeño inmediatamente
        updateSmallMessage(cachedCourseName);

        // Esperar a que el iframe esté listo antes de enviar el mensaje
        setTimeout(function() {
          updateIframeWithData({
            type: 'LEXAI_UPDATE_COURSE',
            courseName: cachedCourseName
          });
          // No abrir chat automáticamente - solo mostrar nubecita
        }, 1500); // Dar tiempo al iframe para cargar
      }
      // Si es un ID numérico, llamar a la API (después de enviar datos de usuario)
      else if (isNumericId(courseIdentifier)) {
        // Esperar a que los datos de usuario se envíen primero (800ms + margen)
        setTimeout(function() {
          console.log('LexAI: Obteniendo nombre del curso desde API...');
          fetchCourseNameFromAPI(courseIdentifier).then(function(name) {
            if (name) {
              cachedCourseName = name;
              console.log('LexAI: Curso detectado (API):', name);

              // Actualizar el mensaje pequeño
              updateSmallMessage(name);

              updateIframeWithData({
                type: 'LEXAI_UPDATE_COURSE',
                courseName: name
              });
              // No abrir chat automáticamente - solo mostrar nubecita
            }
          });
        }, 1200); // Iniciar API después de que usuario se envíe (800ms)
      }
      // FALLBACK: Si es un slug desconocido, formatear el slug como nombre
      else if (!isNumericId(courseIdentifier)) {
        // Convertir slug a nombre legible: "derecho-administrativo-ii2" -> "Derecho Administrativo Ii2"
        cachedCourseName = courseIdentifier
          .replace(/-/g, ' ')
          .replace(/\d+$/, '') // Quitar números al final
          .trim()
          .toLowerCase()
          .replace(/(?:^|\s)\S/g, function(letter) { return letter.toUpperCase(); });

        if (!cachedCourseName) cachedCourseName = 'tu Curso';

        console.log('LexAI: Curso detectado (fallback):', cachedCourseName);

        updateSmallMessage(cachedCourseName);

        setTimeout(function() {
          updateIframeWithData({
            type: 'LEXAI_UPDATE_COURSE',
            courseName: cachedCourseName
          });
          // No abrir chat automáticamente - solo mostrar nubecita
        }, 1500);
      }
    }
  }

  // Escuchar mensajes del iframe para actualizar la nubecita
  window.addEventListener('message', function(event) {
    // Verificar que el mensaje viene del iframe de LexAI
    if (event.data && event.data.type === 'LEXAI_UPDATE_BUBBLE') {
      var smallMessage = document.querySelector('.lexai-small-message');
      var container = document.querySelector('.lexai-widget-container');

      if (smallMessage && event.data.message) {
        // Solo mostrar si el chat está cerrado
        if (!container || !container.classList.contains('active')) {
          smallMessage.innerHTML = event.data.message;
          smallMessage.classList.remove('hidden');
        }
      }
    }
  });

  // Exponer API global para configuración opcional
  window.LexAI = {
    open: function() {
      const container = document.querySelector('.lexai-widget-container');
      const button = document.querySelector('.lexai-widget-button');
      if (container && button) {
        container.classList.add('active');
        button.classList.add('active');
        button.classList.remove('pulse');
      }
    },
    close: function() {
      const container = document.querySelector('.lexai-widget-container');
      const button = document.querySelector('.lexai-widget-button');
      if (container && button) {
        container.classList.remove('active');
        button.classList.remove('active');
        button.classList.add('pulse');
      }
    },
    toggle: function() {
      const container = document.querySelector('.lexai-widget-container');
      if (container && container.classList.contains('active')) {
        this.close();
      } else {
        this.open();
      }
    }
  };
})();
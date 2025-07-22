# Дополнительные найденные проблемы

1. **Дублирование менеджера сессий**
   - Класс `GameController` создаёт собственный `GameSessionManager` и инициализирует `WebSocketServer`.
   - Внутри `WebSocketServer` создаётся ещё один `GameSessionManager`. Это приводит к тому, что методы `cleanupOldSessions` и другие вызываются на другом экземпляре и не влияют на реальные сессии.
   - Пример кода:
     ```ts
     // GameController
     constructor(io: Server) {
       this.gameSessionManager = new GameSessionManager();
       this.storyService = new StoryService();
       this.webSocketServer = new WebSocketServer(io);
     }
     ```
     ```ts
     // WebSocketServer
     constructor(io: Server) {
       this.gameSessionManager = new GameSessionManager();
       this.storyService = new StoryService();
       this.llmService = new OpenAILLM();
     }
     ```

2. **Несогласованность переменных окружения**
   - В `.env.example` фронтенда указана переменная `VITE_WS_URL`, а в коде используется `VITE_SOCKET_URL`.
   - Это может запутать при настройке и привести к неверному адресу WebSocket.

3. **Недостаточная установка зависимостей по умолчанию**
   - Корневой `package.json` содержит лишь одну зависимость и не устанавливает пакеты фронтенда и бэкенда автоматически. Если выполнить просто `npm install`, необходимые библиотеки не будут установлены.

4. **Тесты не запускаются без предварительной установки**
   - При попытке запуска `npm test` без установки зависимостей появляется ошибка `vitest: not found`. Нужно выполнить `npm run install:all` перед тестированием.

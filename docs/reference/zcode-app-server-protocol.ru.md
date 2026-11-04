<!-- Источник: zcode-acp-server 0.27.3 docs/PROTOCOL.md (https://github.com/william0wang/zcode-acp, Apache-2.0, автор William Wang).
     Скопировано 2026-09-07 как справочник протокола ZCode app-server. Исходные изменения проекта: раздел «Изменения в 3.12.2» и пометки в начале затронутых устаревших разделов; остальной текст upstream не менялся. В этой языковой версии переведены пояснения и изменена навигация; примеры протокола сохранены. -->

# Протокол ZCode JSON-RPC

[English](zcode-app-server-protocol.md) · [中文](zcode-app-server-protocol.zh-CN.md) · Русский

Документ описывает внутренний протокол JSON-RPC между zcode-acp-server
и ZCode CLI.

## Изменения в 3.12.2: проверка на реальном устройстве 2026-09-18

> Этот раздел добавлен нашим проектом, его нет в исходном документе zcode-acp-server. Здесь записаны изменения протокола в ZCode App 3.12.2.
> В начале исходных разделов о затронутых методах добавляется пометка «Не действует с 3.12, см. выше». Исходный текст сохраняется для сравнения со старыми версиями.
> Полное обоснование — D14 в [`decisions.md`](../decisions.ru.md) и раздел «Прямая проба 3.12.2» в [`verified.md`](../verified.ru.md).

**Удалённые методы**: `workspace/updateProviderRegistry` и `workspace/readState` возвращают `-32601 Method not found`.
Теперь app-server сам собирает таблицу провайдеров — доступных провайдеров, моделей и способов аутентификации ключом — из двух файлов:
встроенного файла конфигурации провайдеров и персонального файла конфигурации провайдера. Определения приведены в [`CONTEXT.md`](../CONTEXT.ru.md).

**Запуск**: новый CLI сам ищет встроенный файл провайдеров через внутреннюю функцию `resolveBundledZCodeBuiltinProviderConfig`.
Он проверяет только `provider/` рядом с `zcode.cjs` и `config/provider/` на пять уровней выше `zcode.cjs`. Второй путь соответствует структуре исходного репозитория;
в упакованном App он превращается в `/config/…` в корне файловой системы. Если файл не найден, CLI завершается с ошибкой. Реальное расположение —
`<App>/Contents/Resources/config/provider/zcode-builtin.json`. При запуске CLI само приложение передаёт расположение переменной окружения.
При прямом запуске дочернего процесса её никто не задаёт, поэтому мы сами вычисляем и передаём две переменные:
`ZCODE_BUILTIN_PROVIDER_CONFIG_FILE` — путь встроенного файла, вычисленный по `zcode.cjs`, и
`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` — путь записанного нами персонального файла. Если заданы обе, CLI использует их как есть,
не обновляет конфигурацию с CDN и не трогает пользовательский `~/.zcode/v2/provider_config.json`.

**Структура персонального файла провайдера** повторяет встроенную функцию импорта старого формата CLI `importLegacyCliPersonalProviderConfig`:

```json
{"schemaVersion":1,"config":{
  "providerConfigRules":{"providerRules":[{
    "providerId":"zcode-executor","providerName":"zcode-executor",
    "config":{"group":"standard-personal",
              "access":{"type":"api-key","apiKey":"<config.json 里的 key>"},
              "api":{"type":"anthropic-messages","baseUrl":"<config.json 里的 baseURL>"},
              "personalModelIds":["GLM-5.3-Flash","GLM-5.3"],"modelOrder":["GLM-5.3-Flash","GLM-5.3"]}}]},
  "modelConfigRules":{"providerModelRules":[],"manualProviderModelRules":[]}}}
```

Сохранённые заполнители `<config.json 里的 key>` и `<config.json 里的 baseURL>` означают соответственно ключ и baseURL из config.json.

**Новые параметры `session/create`**: схема строгая, дополнительные поля вызывают ошибку.

| Поле | Описание |
| --- | --- |
| `model` | `{providerId, modelId, options?:{reasoningLevel}}`, замена прежнего `runtimeModel` |
| `runtimeModel` | Больше не принимается; его наличие вызывает `Unrecognized key: "runtimeModel"` |
| `thoughtLevel` | По-прежнему нужен на верхнем уровне: при передаче только `options.reasoningLevel` реальная проверка дала пустое `settings.thoughtLevel.current`; надёжнее передавать оба |

Модели GLM-5.3 требуют `options.reasoningLevel`; без него возвращается `Reasoning level is required`. Поле ответа
`settings.model.available` содержит таблицу моделей, распознанных app-server; раньше для неё требовался отдельный `workspace/readState`.
Плагин вычисляет уровни локально из config.json. При рукопожатии `doctor` таблица нужна только для сверки: распознаны ли все модели персонального файла.

**`workspace/generateText`**: параметр `modelRef` переименован в `selection` с той же структурой, что и `model` выше:
`{providerId, modelId, options?:{reasoningLevel}}`. Без `selection` выдаётся
`Unrecognized key: "modelRef"`.

**Новый обратный запрос `interaction/requestProviderRuntimeHeaders`**: согласно исходникам zcode.cjs 3.12.2, порт заголовков в режиме хоста
перед запросом модели запрашивает у клиента заголовки времени выполнения. **Реальная проверка контрольной точки 5 от 2026-09-18 подтвердила: провайдеры api-key этот запрос не отправляют**.
Ходы и generateText напрямую используют ключ персонального файла. Провайдеры аккаунта не проверялись; клиент сохраняет встроенный ответ на всякий случай.
Структура params взята из исходников, реальный экземпляр запроса не перехвачен:

```json
{
  "id": 200,
  "method": "interaction/requestProviderRuntimeHeaders",
  "params": {
    "requestId": "<sessionId>:provider-runtime-headers:<uuid>",
    "sessionId": "sess_...",
    "turnId": "...",
    "workspace": { "workspacePath": "...", "workspaceKey": "..." },
    "modelSelection": { "providerId": "zcode-executor", "modelId": "GLM-5.3" },
    "providerId": "zcode-executor",
    "accountAccess": null,
    "reason": "model-request"
  }
}
```

Две структуры ответа:

```json
{ "headersApplied": true, "requestAuth": { "apiKey": "...", "headers": { "...": "..." } } }
```

```json
{ "headersApplied": false, "errorMessage": "..." }
```

Если ответа нет 180 секунд, ход выдаёт `-32031 Provider runtime headers were not applied before model request attempt`.

**Неизменившиеся методы**: `session/send`, `resume`, `subscribe`, `stop`, `close`, `list`,
`requestRuntimePreferences`, `interaction/requestPermission`, `interaction/requestUserInput`
и типы событий `session/event` не изменились. Жизненный цикл сессии, определение конца хода и три этапа шлюза менять не нужно.

## Обзор протокола

ZCode обменивается через stdio **JSON с разделением по строкам**. Формат похож
на JSON-RPC, но **не содержит поля `jsonrpc`**.

### Классификация сообщений

Тип сообщения определяется наличием `id` и `method`:

| Сочетание | Тип | Направление |
| --- | --- | --- |
| `id` без `method` | Ответ | zcode -> мост |
| `id` + `method` | Запрос | мост -> zcode или zcode -> мост |
| `method` без `id` | Уведомление | В обе стороны |

### Формат запроса

```json
{
  "id": 1,
  "method": "session/create",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    },
    "mode": "yolo"
  }
}
```

### Формат ответа

```json
{
  "id": 1,
  "result": {
    "session": {
      "sessionId": "sess_abc123",
      "title": "your prompt text..."
    }
  }
}
```

### Формат ошибки

```json
{
  "id": 1,
  "error": {
    "message": "prompt is running",
    "code": 1308
  }
}
```

### Формат уведомления

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 42,
    "type": "turn.started",
    "payload": {}
  }
}
```

## Методы жизненного цикла сессии

### `session/create`

Создаёт сессию. Мост откладывает этот вызов до первого использования сессии:
ACP `session/new` возвращает локальный идентификатор-заполнитель, а сессия на стороне сервера
создаётся этим RPC при первом промпте, изменении конфигурации или вызове метода расширения.
Поэтому запуск редактора без отправки сообщения не оставляет сессию.

**Запрос:**

```json
{
  "id": 1,
  "method": "session/create",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    },
    "mode": "yolo"
  }
}
```

**Ответ:**

```json
{
  "id": 1,
  "result": {
    "session": {
      "sessionId": "sess_abc123",
      "title": "",
      "traceId": "trace_xyz789"
    }
  }
}
```

### `session/list`

Возвращает список всех сессий.

**Запрос:**

```json
{
  "id": 2,
  "method": "session/list",
  "params": {
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    }
  }
}
```

### `session/resume`

Возобновляет существующую сессию.

sessionId может быть ленивым заполнителем `session/new`: редактор сохраняет его
и использует для возобновления после перезапуска моста. До обращения к серверу мост
разрешает соответствие из памяти или файла `acp-lazy-sessions.json` и получает настоящую сессию.
Он возобновляет её либо создаёт новую пустую, если заполнитель ещё не использовался.
Настоящие идентификаторы из `session/list` передаются без изменений.

**Запрос:**

```json
{
  "id": 3,
  "method": "session/resume",
  "params": {
    "sessionId": "sess_abc123",
    "workspace": {
      "workspacePath": "/path/to/project",
      "workspaceKey": "/path/to/project"
    }
  }
}
```

### `session/send`

Отправляет промпт.

**Запрос:**

```json
{
  "id": 4,
  "method": "session/send",
  "params": {
    "sessionId": "sess_abc123",
    "content": "your prompt text"
  }
}
```

**Ответ:**

```json
{
  "id": 4,
  "result": {
    "accepted": true
  }
}
```

Повторный `session/send` при уже выполняющемся ходе отклоняется ошибкой JSON-RPC
с кодом `-32010` и сообщением `A prompt is already running for this session`.
Проверка по исходникам ZCode от 2026-09-21: с 3.12.2 запрос отклоняется напрямую, постановка вставок в очередь из 3.11 удалена.

### `session/stop`

Останавливает текущий ход. Это **запрос**: он обязан содержать `id`.
app-server игнорирует сообщения без `id`. Проверено 2026-09-21 по исходникам
ZCode 3.14.0 и локальному zcode.cjs 3.12.2.

**Запрос:**

```json
{
  "id": 8,
  "method": "session/stop",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

**Ответ:** `{}`. В result могут быть дополнительные поля, они игнорируются.
После остановки ход завершается через `turn.completed` с `payload.resultType: "cancelled"`
(см. ниже), а не через `turn.failed`.

### `v4/command`: минимальное использование

Проверено 2026-09-21 по исходникам ZCode 3.14.0 и локальной пробой App 3.12.2 без расхода токенов.
v4 и старые методы `session/*` используют **один поток NDJSON**. Метод — `v4/command`,
а params запроса — конверт команды:

```json
{
  "id": 9,
  "method": "v4/command",
  "params": {
    "commandId": "<任意唯一字符串，客户端用 crypto.randomUUID()>",
    "clientId": "zcode-executor",
    "sessionId": "sess_abc123",
    "type": "sendText",
    "issuedAt": 1758412800000,
    "payload": { "text": "方向改一下，先只改 A", "requestedDelivery": "guide" }
  }
}
```

Сохранённый заполнитель `commandId` означает любую уникальную строку; клиент использует `crypto.randomUUID()`.
Текст «方向改一下，先只改 A» в примере означает «Измени направление: сначала меняй только A».

result ответа — ACK: `{commandId, status, revisionAtDecision, reasonCode?, message?, result?}`,
где `status ∈ accepted | rejected | stale | duplicate | noop | failed`.
`accepted | noop | duplicate` считаются успехом, остальные статусы — ошибкой.

**`requestedDelivery` для `sendText`**: `"guide"` во время занятого хода вставляет ввод после следующего пакета инструментов,
перед следующим запросом модели. Если границы инструментов нет или есть вложения, CLI сам переходит к очереди
(`fallbackReasonCode`): ввод выполняется после завершения хода как следующий. Оба варианта delivery считаются успешной вставкой.
При принятии result имеет форму `{type: "inputAccepted", delivery: "startNow" | "queue", inputId}`.
Это установлено по исходникам, реальный пример не перехвачен. **`sendText` в свободной сессии сразу запускает новый ход**
с `delivery: "startNow"`, поэтому вставка отправляется только во время хода; обычная отправка в свободную сессию идёт через `session/send`.
После принятия вставки старый поток продолжает выдавать обычные события хода `turn.steerQueued` / `turn.steerDrained`.

**`stop`**: `payload: {}` возвращает `{status: "accepted"}` и в свободной сессии, что проверено локально.

**Предварительная подписка на темы v4 и рукопожатие не нужны**: шлюз v4 проверяет лишь существование сессии.
Подходят и сессии старого `session/create`; v4 `createSession` не требуется, у него нет `toolDenylist`.

Четыре локальные проверки: App 3.12.2, 2026-09-21.

| Команда | ACK |
| --- | --- |
| `sendText` для несуществующего sessionId | `{status: "rejected", reasonCode: "proto.sessionNotFound"}` |
| `sendText` с пустым текстом | `{status: "failed", reasonCode: "proto.invalidPayload", message: "input must not be empty"}` |
| `type: "stop"`, `payload: {}` для свободной сессии | `{status: "accepted"}` |
| Прямой `sendText` для сессии старого `session/create` | Работает без подписки и рукопожатия |

### `session/read`

Читает состояние и проекцию сессии.

**Запрос:**

```json
{
  "id": 5,
  "method": "session/read",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

**Ответ:**

```json
{
  "id": 5,
  "result": {
    "projection": {
      "status": "idle",
      "contextUsed": 1234,
      "contextWindow": 32000,
      "totalTokenCount": 5678
    },
    "settings": {
      "mode": { "current": "yolo" },
      "model": { "current": { "modelId": "GLM-5.2" } },
      "thoughtLevel": { "current": "high" }
    },
    "todos": [{ "content": "Implement login", "status": "pending", "priority": "high" }]
  }
}
```

### `session/messages`

Получает историю сообщений сессии.

**Запрос:**

```json
{
  "id": 6,
  "method": "session/messages",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

## Подписка на поток событий

### `session/subscribe`

Подписывается на события сессии.

**Запрос:**

```json
{
  "id": 7,
  "method": "session/subscribe",
  "params": {
    "sessionId": "sess_abc123",
    "deliveryKind": "desktop-continuous",
    "includeSnapshot": true,
    "afterSeq": 0
  }
}
```

**Ответ:**

```json
{
  "id": 7,
  "result": {
    "eventSeq": 42,
    "snapshot": {
      "projection": { ... },
      "messages": [ ... ]
    }
  }
}
```

## Типы событий

После подписки zcode передаёт события уведомлениями `session/event`:

### `turn.started`

Ход начался.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 43,
    "type": "turn.started",
    "payload": {}
  }
}
```

### `model.streaming`

Потоковый вывод модели.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 44,
    "type": "model.streaming",
    "payload": {
      "kind": "text_delta",
      "delta": "this code..."
    }
  }
}
```

Возможные значения `kind`:

- `text_delta`: приращение текста.
- `reasoning_delta`: приращение текста рассуждений.
- `tool_call`: объявление вызова инструмента, кешируются toolName и input.

### `tool.updated`

Обновление состояния инструмента.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 45,
    "type": "tool.updated",
    "payload": {
      "kind": "scheduled",
      "toolCallId": "call_xyz",
      "toolName": "Bash",
      "input": { "command": "ls -la" }
    }
  }
}
```

Возможные значения `kind`:

- `scheduled`: инструмент запланирован.
- `started`: инструмент начал выполнение.
- `progress`: обновление прогресса, stdoutTail / stderrTail.
- `result`: инструмент завершён.
- `error`: ошибка инструмента.
- `batch`: пакетное завершение нескольких инструментов.

### `turn.completed`

Ход завершён.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 46,
    "type": "turn.completed",
    "payload": {
      "resultType": "success",
      "usage": {
        "totalTokens": 1234
      }
    }
  }
}
```

Возможные значения `payload.resultType` приведены ниже. Проверка по исходникам ZCode от 2026-09-21:
исходы, отличные от success, тоже передаются через `turn.completed`, а не `turn.failed`.

| `resultType` | Значение |
| --- | --- |
| `success` | Обычное завершение |
| `cancelled` | Ход остановлен через `session/stop` |
| `error_max_turns` | Достигнут предел числа ходов |
| `error_max_budget` | Достигнут предел бюджета |
| `error_during_execution` | Ошибка во время выполнения хода |
| `error_max_tool_calls` | Достигнут предел числа вызовов инструментов |

### `turn.failed`

Ход завершился с ошибкой.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 47,
    "type": "turn.failed",
    "payload": {
      "error": {
        "code": 1308,
        "message": "prompt is running"
      }
    }
  }
}
```

### `session.updated`

Обновление состояния сессии: расход токенов и другое.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 48,
    "type": "session.updated",
    "payload": {
      "usage": {
        "inputTokens": 1234
      },
      "contextWindow": 32000
    }
  }
}
```

### События жизненного цикла вставки

Когда пользовательский ввод вставляется в выполняющийся ход или ставится за ним в очередь,
сервер выдаёт пару событий жизненного цикла, начиная с app-server 0.15.2.
Мост пока не преобразует их; это отложенное улучшение из `BACKLOG.md` исходного zcode-acp.
Этот файл upstream в данный репозиторий не включён.

```json
{
  "type": "turn.steerQueued",
  "payload": {}
}
```

```json
{
  "type": "turn.steerDrained",
  "payload": {}
}
```

## Протокол взаимодействия: сервер -> клиент

Запросы, которые zcode сам отправляет мосту.

### `interaction/requestPermission`

Запрос разрешения на инструмент.

```json
{
  "id": 100,
  "method": "interaction/requestPermission",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "toolName": "Bash",
    "reason": "run command",
    "input": { "command": "rm -rf /" },
    "options": [
      { "optionId": "allow", "kind": "allow_once", "name": "Allow once" },
      { "optionId": "deny", "kind": "deny_once", "name": "Deny" }
    ]
  }
}
```

### `interaction/requestUserInput`

Запрос пользовательского ввода: ExitPlanMode / AskUserQuestion.

**ExitPlanMode:**

```json
{
  "id": 101,
  "method": "interaction/requestUserInput",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "schema": { "interaction": "plan_approval" },
    "input": { "plan": "1. Implement login\n2. Implement signup" }
  }
}
```

**AskUserQuestion:**

```json
{
  "id": 102,
  "method": "interaction/requestUserInput",
  "params": {
    "requestId": "req_xyz",
    "sessionId": "sess_abc123",
    "toolCallId": "call_xyz",
    "questions": [
      {
        "question": "Select the files to test",
        "multiSelect": true,
        "options": [
          { "label": "auth.test.ts", "value": "auth" },
          { "label": "user.test.ts", "value": "user" }
        ]
      }
    ]
  }
}
```

### Маршрутизация моста: согласование протокола

Запросы ZCode `interaction/*` направляются в разные механизмы взаимодействия ACP
в зависимости от возможностей клиента:

| Тип запроса | Клиент поддерживает elicitation.form | Клиент не поддерживает |
| --- | :---: | :---: |
| Разрешение инструмента (`interaction/requestPermission`) | `session/request_permission` | `session/request_permission` |
| ExitPlanMode (`interaction/requestUserInput` + plan_approval) | `elicitation/create`, форма принятия/отклонения | `session/request_permission` |
| AskUserQuestion (`interaction/requestUserInput`) | `elicitation/create`, единая форма | Отдельный `session/request_permission` для каждого вопроса |

**Определение возможностей**: при `initialize` клиент объявляет поддержку через
`clientCapabilities.elicitation.form`. Сервер проверяет её вызовом
`server.supportsElicitationForm()`.

**Повтор после переподключения**: запросы взаимодействия одноразовые и отправляются наперегонки
клиентам, подключённым в момент возникновения; побеждает первый ответ. Отключённый тогда клиент
их не увидит. Поэтому после завершения `session/load` / `session/resume`, то есть догоняющего
восстановления при переподключении, мост повторно отправляет клиенту ещё не отвеченные запросы сессии.
Короткая задержка позволяет сначала отобразить историю. Повтор участвует в той же гонке:
если другой клиент ответит раньше, переподключённый получает `$/cancel_request`
и должен закрыть диалог.

**Пример формы elicitation** для AskUserQuestion:

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "sessionId": "sess_abc123",
    "message": "Please answer 2 questions.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "q_0": {
          "type": "string",
          "title": "Select the files to test",
          "oneOf": [
            { "const": "auth.test.ts", "title": "auth.test.ts" },
            { "const": "user.test.ts", "title": "user.test.ts" },
            { "const": "__skip__", "title": "Skip this question" }
          ]
        },
        "q_0_other": {
          "type": "string",
          "title": "↳    or type a custom value (overrides the selection)"
        }
      },
      "required": []
    }
  }
}
```

Строковые поля elicitation ACP/MCP бывают ЛИБО перечислением с ограниченным выпадающим списком,
ЛИБО свободным текстом: спецификация запрещает совмещать оба варианта в одном поле.
Поэтому вопрос отображается ДВУМЯ полями: `q_<i>` — список предложенных моделью ответов
`oneOf`/`anyOf` с последним пунктом “Skip this question” («Пропустить вопрос»), где `const` —
маркер `__skip__`, а `title` — понятная человеку подпись, и
`q_<i>_other` — сопутствующее поле свободного текста. При отправке непустое `q_<i>_other`
заменяет выбор списка для одиночного выбора или добавляется к выбранным значениям для множественного.
Выбор “Skip this question” или пустые оба поля пропускают только этот вопрос, не отменяя форму.

**Ответ elicitation**: accept/decline/cancel.

```json
{
  "action": "accept",
  "content": { "q_0": "auth.test.ts" }
}
```

**Форма elicitation ExitPlanMode** содержит единственное текстовое поле `feedback`,
без списка принятия/отклонения. Собственная кнопка отправки клиента означает принятие,
ввод текста — отклонение. Отправка пустого поля принимает план;
отправка текста отклоняет его и возвращает текст zcode как `reason` отказа,
чтобы агент увидел новое направление при повторном планировании.
Кнопка cancel/decline просто отклоняет план без причины.

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "sessionId": "sess_abc123",
    "message": "Ready to code?\n\n1. Implement login\n2. Implement signup\n\nLeave the box empty and submit to approve; type feedback to reject and redirect.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "feedback": {
          "type": "string",
          "title": "Feedback",
          "description": "Empty = approve the plan. Anything typed = reject and use this text as the redirection."
        }
      },
      "required": []
    }
  }
}
```

## Методы расширений, начиная с 0.14.8

### `session/fork`

Создаёт ответвлённую сессию из контрольной точки.

**Запрос:**

```json
{
  "id": 8,
  "method": "session/fork",
  "params": {
    "sessionId": "sess_abc123",
    "target": { "kind": "latestCheckpoint" }
  }
}
```

### `session/rewind`: удалён в 0.16+

`session/rewind` и `session/rewindCascade` существовали до app-server 0.15.x включительно.
В 0.16 они удалены из диспетчеризации RPC: на 0.16.3 подтверждён `-32601 Method not found`.
Откат перенесён в API диалогов v4, включая `v4/conversation/fileRewindPreview`,
которое мост не поддерживает. Поэтому соответствующие расширения ACP
`session/rewind` / `session/rewindCascade` и команда `/rewind` также удалены.
Альтернативой на стороне моста остаётся `session/fork`, ответвление от контрольной точки.

### `session/goal`

Читает, задаёт, заменяет или очищает цель.

**Запрос:**

```json
{
  "id": 10,
  "method": "session/goal",
  "params": {
    "sessionId": "sess_abc123",
    "action": "set",
    "objective": "Refactor the auth module"
  }
}
```

Возможные `action`: `show`, `set`, `replace`, `clear`, `pause`, `resume`.

### `session/compact`

Сжимает историю диалога.

**Запрос:**

```json
{
  "id": 11,
  "method": "session/compact",
  "params": {
    "sessionId": "sess_abc123"
  }
}
```

### `session/steer`: удалён в 0.16+

`session/steer` существовал до app-server 0.15.x включительно. В 0.16 он удалён из диспетчеризации RPC;
на 0.16.3 подтверждён `-32601 Method not found`. Вставка перенесена в API команд/диалогов v4.
Соответственно, расширение ACP `session/steer` и команда `/steer` моста удалены.
Ввод из очереди по-прежнему появляется как события `turn.steerQueued` /
`turn.steerDrained`, описанные выше.

### `session/setMode`

Переключает режим сессии.

**Запрос:**

```json
{
  "id": 13,
  "method": "session/setMode",
  "params": {
    "sessionId": "sess_abc123",
    "mode": "build"
  }
}
```

### `session/setThoughtLevel`

Задаёт уровень размышления.

**Запрос:**

```json
{
  "id": 14,
  "method": "session/setThoughtLevel",
  "params": {
    "sessionId": "sess_abc123",
    "thoughtLevel": "max"
  }
}
```

## Фоновые задачи и субагенты

Когда модель запускает субагента инструментом `Agent` или `Task`, сервер
продолжает выдавать события в **том же потоке сессии** как во время работы субагента,
так и после завершения основного хода. Мост передаёт клиенту ACP выбранное подмножество:

### Синхронный субагент с блокировкой

Инструмент `Agent` блокируется до завершения субагента. Его внутренние вызовы
`Read`, `Bash` и других инструментов приходят обычными событиями `tool.updated` основного потока
и передаются как стандартные карточки `tool_call`. Сама карточка `Agent` содержит
структурированные метаданные в `_meta.subagent`, разобранные из содержимого результата:

```json
{
  "sessionUpdate": "tool_call_update",
  "toolCallId": "call_xxx",
  "status": "completed",
  "_meta": {
    "claudeCode": { "toolName": "Agent" },
    "subagent": {
      "agentId": "agent_73c7c63d-...",
      "tokens": 40904,
      "toolUses": 1,
      "durationMs": 10559
    }
  }
}
```

### Фоновый субагент: `run_in_background: true`

Инструмент `Agent` сразу возвращает подтверждение запуска. Содержимое результата включает
`agentId`, `output_file` и “working in the background” («работает в фоне»).
Основной ход завершается, но сервер продолжает передавать жизненный цикл задачи тем же потоком:

**1. Изменения состояния**: `session.updated` содержит `taskId` и `status`.

```json
{
  "method": "session/event",
  "params": {
    "sessionId": "sess_abc123",
    "seq": 16,
    "type": "session.updated",
    "payload": {
      "taskId": "agent_88a44529-...",
      "toolCallId": "call_orig",
      "toolName": "Agent",
      "status": "running",
      "description": "Read README first heading",
      "outputPath": "/.../output.txt",
      "terminalId": "agent_88a44529-...",
      "startedAt": "2026-07-18T09:06:45.929Z"
    }
  }
}
```

Принадлежащий сессии `BackgroundTaskListener` моста превращает их в отдельную карточку ACP
`[background] <description>` и обновления её состояния:

| Событие сервера | Уведомление ACP |
| --- | --- |
| Первый `session.updated` со статусом `running` | `tool_call`: новая карточка, `kind:"other"`, `status:"in_progress"` |
| `session.updated` со статусом `completed` | `tool_call_update`, `status:"completed"` |

События `session.updated` БЕЗ `taskId`, например обновления расхода токенов,
фоновый обработчик игнорирует: за них по-прежнему отвечает цикл хода.

**2. Ход уведомления о завершении**: после завершения фоновой задачи сервер
автоматически запускает новый ход, у которого `turn.started` содержит
`inputSource:"background_task"`:

```json
{
  "type": "turn.started",
  "payload": {
    "inputSource": "background_task",
    "inputVisibility": "model-only",
    "input": "<task-notification>\n  <task-id>agent_...</task-id>\n  <status>completed</status-status>\n  ...\n</task-notification>",
    "turnId": "turn_95197b25-..."
  }
}
```

Фоновый обработчик передаёт `model.streaming text_delta` этого хода как
`agent_message_chunk`, чтобы пользователь увидел фоновый результат. Цикл отдельного промпта
**пропускает** этот ход целиком, отбрасывая его события, чтобы избежать двойной передачи
и преждевременного завершения настоящего пользовательского хода.

### Фоновый Bash: `run_in_background: true`

Инструмент `Bash` с `run_in_background: true` сразу возвращает подтверждение запуска
с текстом “Command running in background with ID: exec_…” («команда выполняется в фоне с идентификатором exec_…»).
Как и для субагента Agent, сервер продолжает передавать жизненный цикл задачи тем же потоком
через события `session.updated`, содержащие исходный `toolCallId`:

```json
{
  "type": "session.updated",
  "payload": {
    "taskId": "exec_ac3a5053-...",
    "toolCallId": "call_e282b4ec...",
    "toolName": "Bash",
    "status": "running",
    "pid": 22410,
    "outputPath": "/.../call_...-stdout.log",
    "outputTail": "done\n"
  }
}
```

**Повторное использование карточки без дублирования.** В отличие от субагента Agent, создающего новую
карточку `bg_*`, фоновая задача Bash **использует карточку запуска** — ту самую терминальную карточку,
которую диспетчер создал при планировании `Bash`. Жизненный цикл остаётся в одной карточке,
а редактор не показывает дополнительную `[background]` рядом с закрытой карточкой запуска.

Механизм:

1. **Ход запуска**: диспетчер помечает `ToolCallNew`/`ToolCallUpdate` значением
   `background: true`, полученным из закешированного флага `input.run_in_background`.
   При результате запуска он **не отправляет `terminal_exit`**, оставляя карточку `in_progress`.
   Для `toolCallId` записывается пустой маркер в `terminalSentData`: по нему фоновый обработчик
   распознаёт отслеживаемую карточку запуска.
2. **Жизненный цикл, `session.updated`**: `BackgroundTaskListener` определяет `toolCallId`,
   находит его в `terminalSentData` и направляет обновления в карточку запуска.
   При `status:"completed"` он передаёт финальный `outputTail` через `terminal_output`,
   только если текст запуска ещё не передавался потоком, закрывает терминальный интерфейс
   через `terminal_exit` с кодом 0 либо 1 при `failed`, затем удаляет запись `terminalSentData`.
3. **Запасной путь**: если в `session.updated` нет `toolCallId` или он неизвестен
   `terminalSentData`, как в случае субагента, обработчик создаёт новую карточку `bg_*`
   по описанному выше пути субагента Agent.

| Событие сервера | Уведомление ACP для фонового Bash |
| --- | --- |
| Первый `session.updated` со статусом `running` | `tool_call_update` карточки запуска, `status:"in_progress"` |
| `session.updated` со статусом `completed` и `outputTail` | `terminal_output` с финальным выводом, если он ещё не передан, + `tool_call_update` с `terminal_exit`, `status:"completed"` |
| `session.updated` со статусом `failed` | `tool_call_update` с `terminal_exit`, `status:"failed"`, exit_code 1 |

`session/cancelBackgroundTask` для фонового Bash дополнительно выдаёт
`terminal_exit` с `_meta.backgroundTask.cancelled = true`, чтобы терминальный интерфейс
закрылся при отмене.

### `session/cancelBackgroundTask`

Отменяет фоновую задачу. Мост дополнительно помечает соответствующую карточку ACP
как `failed` с `_meta.backgroundTask.cancelled = true`.

| Версия ZCode CLI | session/subscribe | Методы расширений | Примечания |
| --- | --- | --- | --- |
| >= 0.16.0 | Поддерживается | Все, кроме steer/rewind | `session/steer`, `session/rewind`, `session/rewindCascade` удалены upstream в пользу API v4; мост удалил сквозные вызовы и команды `/steer`, `/rewind` |
| >= 0.15.0 | Поддерживается | Поддерживаются все | Полная функциональность |
| >= 0.14.8 | Поддерживается | Частичная поддержка | workspace/* недоступны |
| 0.14.5 ~ 0.14.7 | Не поддерживается | Не поддерживаются | Несовместимо с этим проектом |

## Дополнительные методы сервера, не подключённые к мосту

Сервер предоставляет больше методов RPC, чем использует мост: список субагентов,
получение событий, расход/закрытие сессии, автоматизации, конфигурацию рабочей области, MCP/плагины.
Соответствий в ACP пока нет. Полный список и кандидаты на поддержку описаны в `BACKLOG.md`
исходного zcode-acp; этот файл upstream в данный репозиторий не включён.

## Семантика нескольких клиентов: удалённый доступ

При `ZCODE_ACP_REMOTE=1` мост принимает дополнительные клиенты ACP через WebSocket,
используя общий для машины hub, одновременно с редактором stdio. Все клиенты
разделяют одни серверные сессии. Ниже описано, как один агент обслуживает несколько клиентов.

| Аспект | Поведение |
| --- | --- |
| Уведомления `session/update` | Передаются всем подключённым клиентам. Клиент, не видевший сессию, например редактор при создании сессии с телефона, просто игнорирует обновление. |
| `session/request_permission`, `elicitation/create` | Передаются всем клиентам; **побеждает первый ответ**. Остальные запросы отменяются через `$/cancel_request`: клиент закрывает диалог и отвечает `RequestCancelled`. |
| Возможности | Объединяются через OR при каждом `initialize`: логическое объединение булевых значений, поверхностное слияние `_meta`. Объявленная любым клиентом возможность включается в маршрутизацию. |
| Одновременные `session/prompt` одной сессии | Сериализуются блокировкой вытеснения сессии, как для одного клиента; второй промпт аналогично вытесняет первый или ставится в очередь. |
| `session/cancel` | Влияет на общий ход независимо от клиента-отправителя. |
| Жизненный цикл процесса | Следует за клиентом stdio: при отключении редактора мост и все удалённые подключения завершаются. Удалённые клиенты не продлевают его жизнь. |

Подробности транспорта — API обнаружения hub, аутентификация токеном, примечания о туннелях — находятся
в разделе “Remote Access” README исходного zcode-acp. Этот документ upstream в данный репозиторий не включён.

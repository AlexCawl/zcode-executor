# Локальные проверки (2026-09-07)

[English](verified.md) · [中文](verified.zh-CN.md) · Русский

Здесь описано положение на момент проверки. Перед использованием убедитесь, что файлы, версии и команды ещё существуют.

## Проверка 3.16.3 (2026-10-26, App 3.16.3 / CLI 0.17.0, ноль токенов)

- Проверка обновления, код менять не нужно. Все пять шагов `doctor` пройдены (выбран ключ командного плана аккаунта). `scripts/probe.mjs` не запускался (различий в протоколе нет).
- Проверка исходника zcode.cjs: все нужные методы на месте — `session/create|send|subscribe|stop|close|list|resume|fork|setMode`, `workspace/generateText|cancelGenerateText`, `v4/command|commands/query`, `interaction/requestPermission|requestUserInput|requestProviderRuntimeHeaders`; `turn.completed` и перечисление `resultType` (success/cancelled/error_max_turns/error_max_budget/error_during_execution/error_max_tool_calls) не изменились ни на символ. Условие запуска направления D (переход на v4) не возникло.
- Все добавления — расширения v4 (`v4/attachment/*`, `v4/conversation/subscribe|resync|usage`, `v4/offPeak/lifecycle`, `workspace/hooks/trustGrant`, `session/compact|messages|read|goal|subagents|usage` и т. п.), старые API не удалены. Появился `v4/conversation/subscribe` — для направления D стало больше подготовленных возможностей.
- Ход с расходом квоты не запускался; полная внепиковая отправка на новой версии не повторялась. `OFFPEAK_VERIFIED_APP` остаётся 3.14.1.

## Проверка 3.15.3 (2026-10-14, App 3.15.3 / CLI 0.16.9, ноль токенов)

- Проверка обновления, код менять не нужно. Все пять шагов `doctor` пройдены (выбран личный план аккаунта); `scripts/probe.mjs` полностью пройден (рукопожатие, create/subscribe/list/resume/close, результаты совпадают с 3.14.5). `npm test` 803/803.
- Проверка исходника zcode.cjs: `session/*`, `v4/command`, `workspace/generateText|cancelGenerateText`, `provider/updateAccountConfig`, `interaction/request*`, `modelSelection`/`selectionScope`/`requestedDelivery`, `zcodejwttoken` на месте; конечная точка start plan `zcode.z.ai/api/v1/zcode-plan/anthropic` и модели GLM-5.3/5.3-Flash сохранены. Во встроенном файле провайдеров остались все десять видов провайдеров аккаунта.
- Ход с расходом квоты не запускался (протокол не отличается от 3.14.5, риск низкий); полная внепиковая отправка по-прежнему не повторялась на новой версии. `OFFPEAK_VERIFIED_APP` остаётся 3.14.1.

## Возобновление отправок Start Plan: проверка на реальной установке (2026-10-09, App 3.14.5, после восстановления реализации e26fedb)

- Бесплатная проверка протокола: `provider/updateAccountConfig`, поля send `modelSelection`/`modelExecution.selectionScope`, встроенная запись start-plan (модели GLM-5.3-Flash/5.2/5-Turbo, конечная точка zcode.z.ai/api/v1/zcode-plan/anthropic) полностью сохранены в 3.14.5. `npm test` 755/755.
- Одна отправка с расходом квоты: `send x_* "写 sp.txt" --start-plan --wait` (`写 sp.txt` — «запиши sp.txt»). Запрос действительно через `account:bigmodel-start-plan` дошёл до zcode-plan, **ошибка `captcha verify failed` от 2026-09-29 больше не возникла** — проверка капчей снята, авторизация JWT пройдена. Сервер вернул прикладную ошибку 1005 `exceed quota limit` (квота подписки Start Plan исчерпана), ход завершился как failed с кодом 4, события и причина ошибки записаны корректно. Адаптация канала подтверждена, после восстановления квоты нужно дополнить успешным ходом.

## Дымовая проверка 3.14.5 (2026-10-09, App 3.14.5 / CLI 0.16.9)

- Проверка обновления, код менять не нужно. Все пять шагов `doctor` пройдены; `scripts/probe.mjs` полностью пройден (рукопожатие старых методов, create/subscribe/list/resume/close).
- Проверка исходника zcode.cjs: все используемые методы и обратные запросы на месте — `session/create|send|subscribe|close|list|stop`, `v4/command`, `interaction/requestPermission|requestUserInput|requestProviderRuntimeHeaders`, `workspace/generateText`; новые методы (`session/goal|fork|compact|usage` и т. п.) только добавлены. `~/.zcode/v2/config.json` по-прежнему содержит таблицу `provider` и открытый apiKey.
- Один короткий ход с расходом квоты: `real-send --yes --on-permission allow` записал hi.txt; create (flash/high) → Write вызвал `interaction/requestPermission` → разрешение → `turn` за 13 секунд завершился как done, usage `{input 67365 / output 157 / cacheRead 33536}`, без кода ошибки.
- Внепиковый режим: бесплатный путь `quota` работает (`canTakeNumber:true`, сегодня 0/3). Полная внепиковая отправка на 3.14.5 не повторялась (нужно внепиковое окно); `OFFPEAK_VERIFIED_APP` всё ещё указывает 3.14.1, строка уведомления doctor сохранена.

## Дымовая проверка 3.14.1 (2026-09-22, App 3.14.1 / CLI 0.16.9, плагин 0.3.1, два коротких хода с расходом квоты)

- Ноль токенов: все четыре шага `doctor` пройдены (выбран личный план аккаунта); каждый результат `scripts/probe.mjs` и пробы v4 полностью совпадает с 3.12.2 (рукопожатие старых методов, форма ACK `v4/command`, stop без id игнорируется). В ACK v4 `stop` добавилось поле `memoryEnabled:false`, его можно игнорировать.
- Полный путь плагина: `new` (автоматически выбран провайдер `account:bigmodel-individual-coding-plan`) → `send` (фоновый runner) → `send --steer` во время хода → `follow`. ACK добавленного указания `delivery:"queue"`, события `turn.steerQueued` → `steerDrained`, c.txt записан по дополнительному указанию; три Write разрешены быстрой проверкой; `state.steerUnavailable` равен null.
- cancel: во втором ходе при первом Write вызван `cancel`, в течение секунды получен `turn.completed resultType:"cancelled"`, `last.outcome` cancelled, код 4; ни один из шести файлов не записан, runner завершён, блокировка удалена. В событиях и runner.log нет `enc:v1`, временный каталог провайдера не остался, осиротевшего app-server нет.
- Найдена и исправлена проблема отображения: итог «改动» (изменения) не включал a.txt — Read тоже опускал input, но не имел события разрешения, поэтому резервная логика заимствовала вход первого Write. Изменено на заимствование только у одноимённого инструмента (`lib/cli/common.mjs`).

## Контрольная точка 6c: Coding Plan аккаунта на реальной установке (2026-09-21, App 3.12.2, один короткий ход с расходом квоты)

- `doctor`: ② выполнен вход в coding plan аккаунта (bigmodel, личный ключ есть, командный ключ есть); в config.json 3 доступных провайдера (резервный источник); выбран `account:bigmodel-individual-coding-plan` (apiKey есть); ③ рукопожатие успешно, fast=GLM-5.3-Flash, strong=GLM-5.3. В `--json` поле `config.sources.account` = `{ok:true, providerCount:2, family:"bigmodel", plans:["individual","team"]}`.
- `models`: два провайдера аккаунта выведены первыми, уровни размышления low/high/max (получены из `reasoningLevel.values` в `modelRules` встроенного файла, набор тот же, что low/max/high источника legacy, порядок другой).
- `scripts/real-send.mjs` (по приоритету автоматически выбран личный провайдер аккаунта): create `providerId:"zcode-executor"` (персональный файл), GLM-5.3-Flash; один Write разрешён, ход `done` за 15 секунд, содержимое файла верное. В файле событий нет `enc:v1` и строк формы «32 位.16 位» (32 символа.16 символов); в `os.tmpdir()` нет оставшихся каталогов `zcode-executor-provider-*`.
- Командный ключ проверен только на возможность расшифровки и включения в таблицу провайдеров; реальной отправки с ним не было (по умолчанию выбирается личный; для командного нужен `preferredProvider` в конфигурации плагина).

## Контрольная точка 6b: дополнительные указания и остановка на реальной установке (2026-09-21, App 3.12.2, два коротких хода с расходом квоты)

`scripts/real-send.mjs --steer-after 8 --steer-text …` и `--stop-after 6`, модель GLM-5.3-Flash, все запросы разрешены:

| Проверка | Результат |
| --- | --- |
| `v4/command sendText` во время хода (`requestedDelivery:"guide"`) | ACK `{status:"accepted", result:{delivery:"queue"}}` — **guide в ACK не бывает** (совпадает с исходником); далее события `turn.steerQueued` (payload `delivery:"guide"`, `pendingInputId:"queue_<commandId>"`) → `turn.steerDrained` (`injectedMessageIds`, `drainedInputs[].delivery:"guide"`). Внедрение произошло после записи b.txt и до c.txt (граница инструментов); итоговое содержимое c.txt — `hello-steer` по указанию, ход `resultType:"success"` |
| `session/stop` во время хода (запрос с id) | Ответ `{}`; в ту же секунду `turn.completed`, `payload.resultType:"cancelled"`; `Session.send()` завершает outcome `cancelled`, reason «回合被叫停（resultType=cancelled）» (ход остановлен); оба хода от отправки до действия остановки заняли около 6 секунд, дальнейших записей файлов не было |
| Виды событий | В каждом из двух ходов только `turn.started` и `turn.completed` (плюс steerQueued/steerDrained для хода со steer), нет `turn.failed` и `turn.terminal` |

## Локальная среда

| Компонент | Состояние |
| --- | --- |
| Настольный ZCode App | 3.11.2, вход выполнен, запущен, установлен в тот день (`recentProjects` пуст) |
| ZCode CLI | 0.16.5, `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`, App не добавило его в PATH |
| Учётные данные | `~/.zcode/v2/config.json`, у `builtin:bigmodel-coding-plan` есть ключ, модели `GLM-5.3` / `GLM-5.3-Flash`; `builtin:zai-start-plan` отключён, models пуст |
| Node | Дочернему app-server нужен Node ≥ 22 с `node:sqlite`; в zcode-acp `backend/resolve.js` есть логика определения |

## Трёхступенчатая цепочка с предварительной проверкой Jev (D16, T7, приёмка без затрат)

- Реализован ранний pass Jev; flag/error/skip/исключения передаются исходной быстрой проверке ZCode, затем при необходимости углублённой; ошибка вызова исходной быстрой проверки по-прежнему даёт ask. Версия набора вопросов approval-v2, фиксированная jev-1.13.0, порог прежний — 0.20.
- Части TDD: doctor RED 4→GREEN 9/9; adapter несколько раз RED→GREEN, итог 25/25; gate/review 75/75; runner 29/29; скрипт real-review 4/4. Итог `npm test` **384/384**, код 0, проверка отметок версии пройдена; зависимостей времени выполнения нет.
- Независимая проверка только для чтения нашла проблемы, исправления повторно проверены: внешняя передача хвостов учётных данных при переносе строки/экранированных пробелах/склейке значений в кавычках; ошибочная разметка пути с экранированными пробелами. Повторная проверка — синтетические секреты и fake fetch, рискованные учётные данные дают локальный skip и ноль запросов, исходный текст ошибочного пути сохраняется. Итог в ограниченном объёме — Approve, нерешённых Required/Critical нет; неизвестные кодировки, произвольный shell, гонки символических ссылок и реальная точность модели не гарантируются.
- Интеграционные утверждения проверяют четыре исхода preScreen отдельно от итогового reviewer, единственное событие gate и передачу исходного текста исходной быстрой проверке. Регрессионные тесты покрывают фиксированную модель ответа, фильтрацию значений metadata, итоговую проверку deadline, отмену body при не-2xx, jitter и skip при обрезке окна. Отмена недоверенного body promise не ожидается; принудительное освобождение ресурсов вредоносной подмены не заявляется.
- doctor показывает полную pipeline; при ошибке конфигурации состояние проверки null, без ложного сообщения о ZCode. Фиксированный Write real-review теперь локально пропускает Jev, явно не является измерителем производительности Jev HTTP; отключённая проверка отклоняется до spawn/платного вызова.
- В этом раунде не было настоящего Jev HTTP, платного session/send и нового сравнения производительности. Калибровка approval-v2 на китайских данных и парное измерение трёхступенчатой цепочки требуют отдельного подтверждения; старые примеры не доказывают безопасность новой версии.
- В одном промежуточном запуске набора review-runner возник runner-gone; временные логи уже удалили тесты, причина не подтверждена. Затем независимый запуск 12/12 и соответствующие случаи итогового полного набора прошли; невоспроизведённая проблема не объявляется установленной и исправленной.

## Необязательная быстрая проверка Jev (2026-09-18, история прежнего подхода с заменой этапа)

> Ниже версия до исправлений, эти записи не служат доказательством приёмки новой трёхступенчатой схемы предварительной проверки. Последующая проверка нашла пробелы в замене путей, обработке неизвестных учётных данных, значениях metadata и гонках deadline. «Проверено» здесь относится только к тогдашним примерам, не гарантирует полную безопасность.

- Автоматизированный fake transport проверил фиксированные `jev-1.13.0` / `approval-v1`, пять пунктов Noul, порог 0.20, минимальный state, опущенные тела, удаление учётных данных, нормализацию путей, ограниченные повторы и общий deadline, включающий чтение тела ответа.
- Моки gate/runner проверили: Jev pass даёт ноль `workspace/generateText`; Jev flag/error/adapter throw ровно один раз передаёт запрос углублённой проверке ZCode; на запрос разрешения по-прежнему записывается одно итоговое `executor.gate`.
- Проверено, что doctor сообщает лишь выбор нового runner, не вызывает TypeSafe, не выполняет `session/send` и не показывает ключ.
- `scripts/real-review.mjs` поддерживает оба реальных пути, с ключом конфигурации и без него, требует явный `--yes`, не выводит полный state Jev, тела инструментов и исходный текст модели.
- Проверка с настоящим ключом TypeSafe (2026-09-18): сначала сессии поручено записать `jev-smoke.txt`, стандартный deadline 3 секунды дал `deadline_exceeded`, затем по замыслу один раз запущена углублённая проверка ZCode с разрешением. Прямой вызов Jev с тем же минимальным action и временным deadline 15 секунд вернул pass за 4.665 секунды. Поэтому внутренний общий deadline по умолчанию изменён на 10 секунд (без расширения публичной конфигурации). Следующая отправка в ту же реальную сессию — запись `jev-direct-pass.txt`: Jev сразу pass за 1.290 секунды, единственное событие `review-fast:allow`, углублённых проверок ZCode 0; фактическая модель `jev-1.13.0`, все пять вероятностей <=0.20. Проверка отсутствия секретов в событиях не нашла ключ, Authorization, полный state или текст задания. Моки по-прежнему отвечают за неуправляемые сбои сети/429/schema, их нельзя описывать как свидетельства реальных сбоев.

## Кроссплатформенность (2026-09-08, проверено в CI)

- Все четыре сочетания GitHub Actions — ubuntu-latest и windows-latest, Node 22 и 24 — запускаются без установки зависимостей.
- **Glob в `node --test` нельзя заключать в кавычки.** `node --test 'test/*.test.mjs'` в Windows не находит ни файла:
  npm запускает скрипты через pwsh/cmd, одиночные кавычки не снимаются, node получает буквальную строку с кавычками.
  При отсутствии совпавших файлов `node --test` **завершается кодом 0** (проверено локально), поэтому вся конфигурация CI ложно зелёная, а `tests 0` скрыто в логах.
  Без кавычек правильно на обеих системах: POSIX shell сам раскрывает glob, Windows оставляет это node.
- **Нельзя передавать каталог аргументом.** `node --test test/` считает тестами и `helpers.mjs`, `mock-appserver.mjs`, и другие нетестовые файлы, сразу завершается ошибкой.
- **Известные реальные отличия Windows (проверено в CI, не ошибки тестов)**:
  - Имена файлов очереди не допускают двоеточия. ISO-метка времени как имя в Windows всегда даёт ENOENT, ломая все `send` (исправлено, `lib/queue.mjs`).
  - `SIGTERM` не поступает. Обработчик Node не выполняется, завершение runner (итоговый state, удаление блокировки) не происходит, код выхода null вместо 0,
    файл блокировки остаётся. Для поддержки нужен другой сигнал остановки в Windows.
  - `process.kill(-pid, 'SIGKILL')` не завершает группу процессов (`lib/appserver.mjs`), можно завершить только прямой дочерний процесс, внуки zcode остаются сиротами.
    CI это не покрывает (нужен настоящий zcode), вывод сделан из кода.
  - Проверка вложенности путей — сравнение строковых префиксов (`lib/review/hard.mjs`), нечувствительность Windows к регистру может ошибочно выглядеть как выход за границы.
    Направление консервативное (больше передач человеку, ошибочного разрешения нет), CI также не покрывает.
- **Два случая иногда не проходят в CI**: «exitAfter:send 重投» в `run.test.mjs` (повторная отправка после exitAfter:send) и
  «信封 id 只保留最近 5 个» в `appserver.test.mjs` (хранить только 5 последних id конвертов). Оба запускают настоящие дочерние процессы и зависят от времени; три запуска одного коммита подряд: в первых двух по одному сбою, третий полностью пройден.
  Локально по три запуска на Node 22 и 25 пройдены. Прежде чем оценивать красный результат, повторить запуск.
- Шесть случаев набора используют средства только Unix (SIGSTOP для заморозки runner, нормализация символических ссылок `/tmp`), в Windows пропускаются и не являются дефектами продукта.
- Расположение ZCode App (из zcode-acp `resolve.js`, `bundledZcodeCandidates`): macOS `/Applications/ZCode.app/…`
  и `~/Applications/…`; Linux обычно `/opt/ZCode/resources/glm/zcode.cjs`, `/usr/share/zcode/resources/glm/zcode.cjs`,
  но официально — «в каталоге распакованного приложения», постоянного пути нет; Windows `%LOCALAPPDATA%\Programs\ZCode\resources\glm\zcode.cjs` (не проверено).
  На всех трёх платформах резервный вариант — `ZCODE_BIN`.

## Протокол app-server

Полный протокол — в `reference/zcode-app-server-protocol.md`. Ниже результаты локальных проверок,
которые не описаны в документации или расходятся с ней. Проверялось через zcode-acp-server 0.17.1;
пометка «для прямого подключения неприменимо» означает поведение, созданное самим zcode-acp.

| Проверка | Результат |
| --- | --- |
| Запуск | `[node, zcode.cjs, "app-server", "--stdio"]`; coder-mcp-bridge дополнительно задаёт `ELECTRON_RUN_AS_NODE=1`, `NO_COLOR=1`, удаляет `ZCODE_MODEL` |
| Конверт | С 0.16+ нет поля `jsonrpc`: запрос `{id, method, params}`, ответ `{id, result}` / `{id, error}`, уведомление `{method, params}` |
| Рукопожатие | Новые app-server сначала отправляют обратный `session/requestRuntimePreferences`, без ответа `session/create` зависает. zcode-acp отвечает `{nativeSearchEnhancementsEnabled:false, memoryEnabled:false, askUserQuestionAutoResolutionEnabled:false}` |
| `session/create` | Сразу возвращает настоящий id `sess_`. coder-mcp-bridge передаёт `{workspace:{workspacePath,workspaceKey}, persistence:"immediate", titleGenerationEnabled:false}` и необязательные `mode` (plan/build/edit/yolo/auto), `toolAllowlist`, `toolDenylist`, `runtimeModel`, `thoughtLevel` |
| Обратные запросы | `interaction/requestPermission`, `interaction/requestUserInput` (AskUserQuestion, ExitPlanMode), `interaction/requestProviderRuntimeHeaders`, `interaction/requestOfficialMcpAuthHeaders`. Неотвеченный запрос повторяется раз в секунду, `params.requestId` тот же, но **id конверта каждый раз новый**; zcode-acp сохраняет все id, затем отвечает каждому и кеширует ответ для запоздалых повторов (`handlers/server-requests.js`, строки 271–290). Принимается ли ответ только первому конверту — не проверено, полагаться нельзя |
| Согласование | В режиме yolo запросов разрешения 0, файлы пишутся сразу. optionId разрешения содержит `allow_once`, нераспознанный id считается отказом. **Форма ответа** (zcode-acp `interaction/adapter.js` и `handlers/server-requests.js`): `requestPermission` — `{decision:"allow"}` либо `{decision:"deny", reason}`; `requestUserInput` (AskUserQuestion) — `{action:"accept", content:{answers:{[question 原文]: "value"}}}` (`question 原文` — исходный текст вопроса; несколько вариантов соединяются `", "`), отказ отвечать — `{action:"decline", reason}`; ExitPlanMode тоже использует `{decision}`, в режиме build не встречается |
| Конец хода | События `turn.completed` / `turn.failed` / `turn.terminal`. zcode-acp дополнительно имеет резервные механизмы: 120 секунд без сигнала и 10 минут неизменного водяного знака; нужны ли они при прямом подключении, ещё не проверено |
| `session/send` | Ещё одно сообщение во время хода ставится в очередь как вход steer |
| Виды событий | `turn.started`, `model.streaming`, `tool.updated`, `turn.completed`, `turn.failed`, `session.updated`, `state.updated` (смена модели/режима); `computer-use/operation-event` и `process/mcpTelemetry` можно отбрасывать |
| resume | Межпроцессный resume сохраняет выбор модели и контекст (в zcode-acp 0.17.1 первая отправка после resume отклонялась: при синхронизации таблицы не отфильтрованы пустые провайдеры, исправлено в 0.18.1; при прямом подключении фильтруем сами) |
| Удалённые методы | В 0.16+ удалены `session/steer`, `session/rewind`, `prompt/enhance*`; в 0.16.5 удалены `automation/*` |
| `workspace/generateText` | Получено из zod schema zcode.cjs (реального вызова не было): params `{workspace, modelRef:{providerId,modelId,variant?}, prompt 或 messages（至少一个）, tools?, querySource（必填字符串）, maxOutputTokens?, operationId?}` (нужен хотя бы один из prompt/messages, querySource — обязательная строка), **поля thoughtLevel нет, уровень размышления передаётся через `modelRef.variant`**; result `{text, modelRef, toolCalls?, finishReason?, usage?}`. Используется существующий процесс сессии workspace, при отсутствии запускается временный и закрывается после использования. Params `cancelGenerateText` — `{operationId}`. zcode-acp его не использует |
| `workspace/readState` | Единственный метод, возвращающий весь набор доступных моделей. Params `{workspace, preferWorkspaceDefaults?, runtimeModel?}`, result `settings.model.{current,available[],lastUsed}`, у модели `ref、label、reasoning.{enabled,levels[],defaultLevel}、disabledReason`; `settings.thoughtLevel.{enabled,current,defaultLevel,available[]}`. Result `session/read` содержит те же settings. zcode-acp его не использует, напрямую читает config.json |
| Уровень размышления | На уровне протокола свободная строка, допустимые значения зависят от модели. Семейство GLM-5.3 `low / high / max` (по умолчанию max), без medium и отключения; GLM-5.2 имеет `nothink`; модели-переключатели — `enabled / disabled`. Недопустимое значение в `session/create` **молча игнорируется**, только warn; ошибку выдаёт `session/setThoughtLevel`. CLI признаёт `disabled/none/off/nothink` отключением, но использовать можно только значения из levels этой модели |
| diff | Протокол даёт только имена изменённых файлов, без содержимого. Приёмка через `git diff` |

## Проба прямого подключения (2026-09-07, CLI 0.16.5, T0.2)

| Проверка | Результат |
| --- | --- |
| Прямой `session/create` | **Без предварительной передачи таблицы провайдеров отклоняется**: `-32603 ModelProtocolError: Model config is missing. Create ~/.zcode/cli/config.json with an explicit model provider`. Локальный `~/.zcode/cli/config.json` содержит лишь `skills`, все модели и провайдеры — в `~/.zcode/v2/config.json`, app-server сам его не читает |
| Таблица провайдеров | zcode-acp перед `session/create` отправляет `workspace/updateProviderRegistry {workspace, registry:{providers[], generatedAt, revision}}`, registry строится из `provider` файла `~/.zcode/v2/config.json`: запись `{providerId, kind, apiFormat（anthropic→anthropic-messages）, baseURL, label, models[]（数组，不是对象）, source, apiKey:{source:"inline", value}}` (apiFormat преобразует anthropic в anthropic-messages, models[] — массив, не объект); элемент `models[]` — `{modelId, label?, contextWindow?, maxOutputTokens?, reasoning:{enabled, levels[{value,label}], defaultLevel}}`. **Провайдеры с пустым models нужно отфильтровать** (schema требует ≥1); локальный `models` у `builtin:zai-start-plan` — пустой **массив** `[]` (у остальных объект) |
| Форма локального config.json | На верхнем уровне только `provider`; все шесть провайдеров имеют `kind:"anthropic"`, `source:"custom"`, отсутствие `enabled` означает включение; `options.{apiKey, baseURL, apiKeyRequired?}`; `models` — объект `{GLM-5.3:{…}, GLM-5.3-Flash:{…}}` |
| `session/requestRuntimePreferences` | При прямом подключении 0.16.5 **не получен** (по крайней мере до отказа create). Обработчик ответа сохранён, ждать его нельзя |
| `workspace/readState` до передачи таблицы | Нормальный ответ, но `modelCatalog.available` и `settings.model.available` пусты, `current` — `{providerId:"zcode-unconfigured", modelId:"missing-model"}`, `thoughtLevel.enabled:false`. Поэтому уровни нужно назначать по данным после передачи таблицы |
| После передачи таблицы (T0.2b) | `updateProviderRegistry` отвечает ok, backend сохраняет `revision` без изменений как `appliedProviderRevision` (признак изменения, стабильный хеш полезен). Успешный `session/create` возвращает id `sess_` и settings: `mode.current:"build"`, `thoughtLevel.current:"high"` (переданное принято и возвращено, available `low/high/max`, defaultLevel `max`); **модель по умолчанию — `builtin:bigmodel` (с оплатой API Key), а не coding-plan**; одноимённые модели есть у трёх провайдеров, всего 6 записей. `list` возвращает массив с новым id, `close` — `{closed:true}` |
| Форма ответов (снято T0.3) | `updateProviderRegistry` возвращает `{appliedProviderRevision, providerCount, status, workspace, workspaceState}`; `session/list` — **объект `{sessions:[…]}`** (элементы содержат sessionId и др.), не голый массив; `session/subscribe` **обязан иметь `deliveryKind`** (используется `desktop-continuous`), иначе отказ |
| `toolDenylist` | `['WebSearch']` принимается schema без ошибки create. Действительное отключение инструментов нужно проверять на ходе |
| Порядок `session/requestRuntimePreferences` | Приходит **после успешного create**, params `{sessionId, scope:"runtime-materialization"}`. Это материализация после create, не предварительное рукопожатие; обработчик должен действовать постоянно, а не только ожидать до create |
| Лог CLI | У пробной сессии только info и один warn `session.model_selection.persist_failed` (Session model selection persistence failed, без details), нет error. Влияние warn неизвестно, пока зафиксировано |

## Проба прямого подключения 3.12.2 (2026-09-18, App 3.12.2, CLI --version всё ещё 0.16.5)

3.12.2 полностью заменил «хост передаёт таблицу провайдеров app-server» на «app-server сам читает два файла», старое рукопожатие несовместимо.
Всего пять слоёв: первые два видит пользователь, остальные три появляются только после исправления первых двух (решение — decisions.md D14):

| Слой | Симптом | Настоящая причина | Влияние |
| --- | --- | --- | --- |
| 1 | `zcode: 无法定位 CLI ZCode Built-in Provider Config：…/glm/provider/zcode-builtin.json, /config/provider/zcode-builtin.json` (не удаётся найти встроенную конфигурацию провайдеров CLI); дочерний процесс сразу завершается code=1 | Новый CLI при запуске сам ищет встроенную конфигурацию (`resolveBundledZCodeBuiltinProviderConfig`) лишь в двух местах: `provider/` рядом с `zcode.cjs` и `config/provider/` на пять уровней выше `zcode.cjs` — это структура исходного репозитория, в упаковке App получается корневой `/config/…`. Настоящий путь — `<App>/Contents/Resources/config/provider/zcode-builtin.json`. App сообщает его CLI переменной окружения, при прямом spawn сообщить некому | Все команды: doctor, models, runner не работают |
| 2 | `workspace/updateProviderRegistry` → -32601 Method not found; `workspace/readState` тоже удалён | Методы удалены. `startProcessProviderRegistryRuntime` внутри app-server собирает таблицу из встроенного и персонального файлов конфигурации. Персональный по умолчанию — `~/.zcode/v2/provider_config.json`, локально пуст (`providerRules: []`), потому что пользователь использует OAuth coding plan аккаунта, в App нет API-key-провайдера | Рукопожатие, doctor ③, models не работают |
| 3 | (После исправления 1 и 2) `session/create` → -32602 `Unrecognized key: "runtimeModel"` | Params create теперь strict schema, `runtimeModel` заменён на `model: {providerId, modelId, options?: {reasoningLevel}}`; у GLM 5.3 `reasoningLevel` обязателен, без него `Reasoning level is required` | Runner не создаёт сессию |
| 4 | (Аналогично) `workspace/generateText` → -32602 `Unrecognized key: "modelRef"` | `modelRef` переименован в `selection`, форма как у `model` выше; прежний `variant` заменён на `options.reasoningLevel` | Все проверки моделью передаются человеку (шлюз по замыслу безопасен при отказе, разрешения нет) |
| 5 | **Опровергнуто в контрольной точке 5 (2026-09-18, реальные send + generateText)**: запросы модели api-key-провайдера **не вызывают** предварительно обратный `interaction/requestProviderRuntimeHeaders`, и ход, и generateText сразу используют ключ персонального файла для open.bigmodel.cn. Прежний вывод (порт headers режима host всегда `shouldRefreshBeforeModelRequest`) упустил условие по типу провайдера | Клиент сохраняет встроенный ответ (с ключом `{headersApplied:true, requestAuth:{apiKey}}`, без него `{headersApplied:false, errorMessage}`), поэтому обработает и реальный запрос аккаунта; mock отправляет только при `runtimeHeaders:true` в сценарии | Нет (реальный ход done, быстрая проверка моделью: 1 generateText вернул Y) |

Не изменилось (schema параметров проверены на новой версии): `session/send`, `resume`, `subscribe`, `stop`, `close`, `list`, `requestRuntimePreferences`, `interaction/requestPermission`, `interaction/requestUserInput`, виды событий `session/event`. Поэтому жизненный цикл сессии, определение конца хода и три слоя шлюза менять не нужно.

Два дополнительных факта:

- `node zcode.cjs --version` на 3.12.2 всё ещё выводит `0.16.5`, как на 3.11.2. **Номер версии не отличает старую версию от новой**, для doctor нужен другой признак.
- Источник ключа: `builtin:bigmodel-coding-plan.options.apiKey` в `~/.zcode/v2/config.json` (в новой версии — legacy CLI config) по-прежнему открыт, App 3.12.2 продолжает писать файл (mtime 2026-09-18 00:23). Все значения `credentials.json` зашифрованы `enc:v1:`, прочитать не удаётся. Пока ключ приходится брать из config.json; если App перестанет его писать, источник исчезнет — это главный внешний риск после адаптации, doctor должен заранее его сообщать.

Пробный скрипт включён в `scripts/probe.mjs` (d2863e2).

Контрольная точка 5 (2026-09-18, App 3.12.2, с расходом квоты): один ход `scripts/real-send.mjs --yes --on-permission allow`
(GLM-5.3-Flash, `model` + верхнеуровневый `thoughtLevel`) → запрос разрешения Write → allow → `turn.completed`, outcome done,
hello.txt создан; одна быстрая проверка `scripts/real-review.mjs --yes` через `workspace/generateText` (`selection` с
`options.reasoningLevel:'low'`, inputTokens 4979) вернула Y. Ни один путь не получил `requestProviderRuntimeHeaders`.
После выполнения исходный apiKey не найден в `~/.zcode/cli/log/zcode-2026-09-18.jsonl`, в `$TMPDIR` не осталось персональных файлов провайдера.
В потоке событий 3.12 добавились уведомления `v4/telemetry/event`, `process/mcpTelemetry`, `computer-use/operation-event`;
обрабатываются как неизвестные события с записью без изменений, определение конца хода не затронуто.

Форма params обратного запроса `interaction/requestProviderRuntimeHeaders` (из исходника zcode.cjs 3.12.2;
в реальной контрольной точке 5 api-key-провайдер его не присылал, аккаунт не проверен, реальный экземпляр не снят): `{requestId: "<sessionId>:provider-runtime-headers:<uuid>", sessionId, turnId?,
workspace, modelSelection: {providerId, modelId}, providerId, accountAccess?, reason: "model-request"}`;
ответ `{headersApplied: true, requestAuth: {apiKey?, headers?}}` или `{headersApplied: false, errorMessage?}`.

### Основания воспроизведения в mock (проба 2026-09-18)

Источники пометок «реальная установка» в mock (`test/mock-appserver.mjs`) для сверки при проверке:

a. Форма элемента `settings.model.available` ответа create: `{ref:{providerId,modelId}, label（=modelId）,
   providerLabel, contextWindow: 1000000, maxOutputTokens: 128000, reasoning:{levels:[low,high,max],
   defaultLevel:'max'}, properties:{inputFormat…, outputFormat…}}` (label равен modelId); `settings.thoughtLevel` содержит только
   available / current / enabled, без defaultLevel.
b. Если create получает только `model.options.reasoningLevel`, без верхнего `thoughtLevel`, `model.current` возвращает лишь
   `{providerId, modelId}` (без options), ключ `thoughtLevel.current` отсутствует; оба есть только при передаче обоих. Без
   `model` create берёт первую модель таблицы, reasoningLevel — верхний thoughtLevel, если нет — max.
c. Исходные ошибки: create с runtimeModel → -32602 `Invalid params — (root): Unrecognized key: "runtimeModel"`;
   модели нет в таблице → -32603 `Provider Registry 中不存在 Model: <providerId>/<modelId>` (модели нет в Provider Registry; data.name = Error /
   ModelProtocolError); нет reasoningLevel → -32603 `Reasoning level is required for <providerId>/<modelId>`;
   generateText с modelRef → -32602 `Invalid params — selection: Invalid input: expected object, received
   undefined; (root): Unrecognized key: "modelRef"`; старый метод → -32601 `Method not found: <method>`.
d. Сессия с `persistence: 'deferred'`: create успешен, close возвращает `{closed:true}`, до и после `session/list` её
   не показывает.
e. Ключи объекта session: createdAt, mode, traceId, sessionId, sessionKind, status, target, title,
   updatedAt, workspace (у session в ответе create 3.12.2 нет model).
f. Message ошибки `-32031` — `errorMessage ?? "Provider runtime headers were not applied
   before model request attempt."` из ответа клиента (из исходника zcode.cjs).

## Проба v4/command (2026-09-21, App 3.12.2, ноль токенов)

Основания смены пути дополнительных указаний: протокол из открытого исходника ZCode 3.14.0 + локальная бесплатная проба App 3.12.2
(только v4/command, без запросов модели). v4 и прежние `session/*` используют один поток NDJSON, имя метода
`v4/command`, params запроса — конверт команды (`commandId` через `crypto.randomUUID()`,
постоянный `clientId`, `sessionId`, `type`, `issuedAt`, `payload`); result ответа — ACK
`{commandId, status, revisionAtDecision, reasonCode?, message?, result?}`, шесть состояний
`accepted | rejected | stale | duplicate | noop | failed`. Четыре локальные проверки:

| Проверка | Результат |
| --- | --- |
| `sendText` для несуществующего sessionId | `{status:"rejected", reasonCode:"proto.sessionNotFound"}` |
| `sendText` с пустым текстом | `{status:"failed", reasonCode:"proto.invalidPayload", message:"input must not be empty"}` |
| `type:"stop"`, `payload:{}` для свободной сессии | `{status:"accepted"}` |
| Прямой `sendText` в сессию прежнего `session/create` | Работает: подписка на темы v4 и рукопожатие не нужны, шлюз v4 проверяет только наличие сессии |

Два дополнения из исходника (не проверялись реально): принятый `sendText` имеет `result`
`{type:"inputAccepted", delivery:"startNow"|"queue", inputId}`; `requestedDelivery:"guide"`
при занятом ходе внедряется после следующего пакета инструментов, перед следующим запросом модели; если границы инструментов нет или есть вложения, CLI
возвращается к очереди (`fallbackReasonCode`), указание выполняется как следующий вход после хода. **В свободной сессии `sendText`
сразу запускает новый ход (startNow)**, поэтому дополнительные указания отправляются только во время хода. После принятия прежний поток событий по-прежнему передаёт
`turn.steerQueued` / `turn.steerDrained` (уже встречались в нашем events.jsonl во времена 3.11).

## Первая отправка на реальной установке (2026-09-07, CLI 0.16.5, контрольная точка 1)

Два платных вызова: ход «新建 hello.txt» (создай hello.txt), затем завершение процесса, resume и ещё один вопрос.

| Проверка | Результат |
| --- | --- |
| **create должен включать `runtimeModel`** | Одной таблицы провайдеров мало: ход сообщает `provider_not_configured`, «Model provider is missing an API key: builtin:bigmodel» (неудачный ход не учитывает usage). С create `runtimeModel:{revision, generatedAt, model:{providerId, modelId}, provider:<registry 里那一项，含 apiKey:{source:"inline"}>}` (provider — запись реестра с apiKey) ход работает, settings.model.current соответствует заданному provider/model (также решает выбор API Key-провайдера по умолчанию) |
| resume | Новый процесс через `session/resume {sessionId, workspace}` **без runtimeModel** подключается и нормально отправляет, контекст полный (вопрос «刚才建了什么文件», «какой файл только что создан», ответ hello.txt) |
| Согласование в build | `Write` вызывает `interaction/requestPermission`, reason «Tool has side effects and requires approval». **Каждый элемент options содержит объект `response`**: `{kind:"allow_once", optionId:"allow_once", response:{decision:"allow", reason:"Approved once"}}`, `{kind:"allow_always", optionId:"allow_project", response:{decision:"allow", permissionUpdates:[{behavior:"allow", rules:[{toolName, ruleContent}], type:"addRules"}], reason:"Approved for this project"}}`, **`{kind:"deny", optionId:"deny", response:{decision:"deny", reason:"Denied"}}` (kind отказа — `deny`, не deny_once)**. Наш ответ `{decision:"allow"}` принят |
| Поток событий | Ход: `turn.started` (payload содержит input, turnNumber, queryId) → `session.updated`×8 → `model.streaming`×15 → `tool.updated`×4 (kind: scheduled / started / с result / batch, `toolName` в scheduled и started) → по одному `permission.requested` / `permission.resolved` → `checkpoint.created` → `turn.completed`. В `turn.completed.payload` есть `response` (полный последний ответ), `usage` (inputTokens/outputTokens/totalTokens/cacheReadTokens…), `toolCallCount`, `duration`, `resultType:"success"`. Также много `v4/telemetry/event` (73), `computer-use/operation-event`, `process/mcpTelemetry`, можно отбрасывать |
| Квота | Ход записи файла: input 32k / output 91 (cacheRead 16k); вопрос после resume: input 16k / output 9. Системный запрос тяжёлый, затраты передачи работы считать по числу ходов |
| Не проверено | События после `session/stop`; `inputSource: background_task`; приём старого id конверта после ожидания больше минуты; `turn.terminal` не встречался (только completed) |
| Лог CLI | Каждый ход — один warn `session.model_selection.persist_failed`, без error |
| Полный путь CLI (2026-09-08, снимок T2.4b, четвёртый платный вызов) | `new` (локальный id, без создания сессии) → `send --wait` сразу возвращает 5 и pending → `status` показывает pending и последние инструменты → `approve` applied → `follow` получает done (usage как при первой отправке, около 32k входа) → файл записан → `list` показывает локальный id и `sess_`. Runner успешно создаёт сессию при первой отправке, в логе CLI нет error |
| Поле параметров запроса разрешения | В params `interaction/requestPermission` параметры инструмента находятся в **`input`** (реальный pending.json уже содержал `toolName`, `input.file_path`, `input.content`, `input.command`). Форма MultiEdit со стороны zcode не встречалась |
| Реальный `workspace/generateText` (2026-09-08, T3.2 `scripts/real-review.mjs`, шестой платный вызов) | Принимает `querySource:"zcode-executor.review"`, `modelRef.variant:"high"` (coding-plan Flash), форму messages; быстрая проверка за 5.3 секунды, usage input 5010 / output 286, ответ `{text, usage}` совпадает с zod schema. На «任务单授权的 Write hello.txt» (Write hello.txt, разрешённый файлом задания) модель отвечает Y → разрешение |
| Реальный вопрос (2026-09-08, девятый платный вызов) | Params `interaction/requestUserInput`: `{questions:[{header, question, multiSelect, options:[{label, value, description}]}]}` (ещё requestId, sessionId, toolCallId). **У инструмента AskUserQuestion zcode нет отдельного value**; модель сообщила «工具不支持 value 字段，改用 label 承载» (инструмент не поддерживает value, используется label), фактически value совпадает с label. Наш `answer <id> 2` отправил `{action:"accept", content:{answers:{"<question 原文>":"用 hello"}}}` (label; `<question 原文>` — исходный вопрос, `用 hello` — используй hello), zcode принял и записал `hello` по выбору. Путь answer работает |
| Обработка ответа AskUserQuestion (исходник zcode.cjs, 2026-09-08) | Strict schema `{action:"accept"|"decline"|"cancel", content?: record, reason?}`. `content.answers` использует **исходный текст `question`** как ключ (резервный `content.answer_<下标>`, где `<下标>` — индекс, для одного вопроса `content.answer`); значения только проходят `trim()` и **передаются модели без изменений** (`"问题"="答案"`, «вопрос»=«ответ»), не сверяются с value/label вариантов; массивы соединяются `", "`, равнозначно строке. `options[].value` добавляет app-server, всегда равно `label` (у schema модели нет value). Пустой объект `answers` — пользователь не ответил (решает модель); все ключи не совпали → инструмент ошибается «requires user answers». decline/cancel → инструмент не выполняется, модель видит отказ отвечать. Только plan_approval сравнивает значение точно: ключ «Review this implementation plan.», значение должно быть `approve` |
| Семь проверок после передачи (2026-09-08, платные вызовы с одиннадцатого по восемнадцатый, main cca7903) | ① **Ход фоновой задачи**: задание просит модель через Bash `run_in_background` выполнить `sleep 8 && echo done > bg.txt`, затем опрашивать; за всё время один `turn.started` (turnNumber 0, без inputSource), нет хода `background_task`, нормальный `turn.completed`. Завершение фонового Bash 0.16.5 не запускает новый ход (субагент Agent не проверялся). ② **approve после ожидания 75 секунд**: ответ принят, работа продолжилась (следующий шаг через 9 секунд), хранения последних 5 id конвертов достаточно. ③ **Две параллельные сессии**: два runner, два дочерних app-server одновременно, оба done за 24 секунды, без error в CLI. ④ **resume с Session not found → пересоздание**: в реестре подменён sessionId, повторная отправка — `executor.recreated`, успешный create, новый id записан, файл создан. ⑤ **toolDenylist действует**: после `--deny "Write Edit MultiEdit"` только Read и Bash (запись через echo), Write ни разу. **`session/stop` после cancel**: за 5 секунд ожидания zcode не прислал конец хода (выполнялся Bash sleep), только прогресс `tool.updated`; по истечении срока отключились с итогом `cancelled`, осиротевших процессов нет. ⑥ **`cancelGenerateText`** реально вернул `{operationId, cancelled:false}` (уже завершилось за 150 миллисекунд), форма совпала с zod. ⑦ **Углублённая проверка**: Bash `git push --force origin main`, быстрая N → первая строка углублённой «结论： ask» (вывод: ask), 65 токенов вывода, причина «命中 git-force-push…没点到 force push 也没点到 main» (сработал git-force-push, ни force push, ни main не указаны), при бюджете 2000 обрезки нет. Также на попытку Bash `mkdir` за пределами рабочего дерева углублённая проверка ответила ask (outside-worktree), значит правило границ в запросе действует на Bash |
| Уровень размышления проверки моделью low (2026-09-08, десятый платный вызов) | Один запрос быстрой проверки: `variant:"low"` — 3 токена, 2.1 секунды; `high` — от 158 до 286 токенов, от 4 до 5 секунд. Значение проверки по умолчанию изменено на low |
| Обрезка углублённой проверки моделью (тот же день) | Быстрая проверка выдала flag для Write в пределах задания; при `maxOutputTokens:600` углублённая модель сначала долго рассуждала по пунктам, до строки вывода была обрезана → ошибка `parseSlow` → review-failed, передача человеку. При high бюджет вывода нужно оставлять на рассуждения, 600 для углублённой проверки мало |
| Контрольная точка 3 (2026-09-08, main 8c5ff23, седьмой и восьмой платные вызовы) | A запись в пределах задания: быстрая Y, разрешена автоматически, без ожидания, `executor.gate` stage review-fast с причиной, ход done, файл записан. B запись за границей: `Write` вне cwd → ожидание по жёсткому правилу (stage hard, ruleId outside-worktree, why с путём), после `approve` ход продолжился, внешний файл записан. В обоих случаях runner не остался. Бюджет быстрой проверки 300 дал около 160 токенов за 4 секунды |
| Контрольная точка 2 (2026-09-08, main ab6dfc8, пятый платный вызов) | Настоящее рабочее дерево + `--task`: `new` → `send --wait --task` 5 (Write) → `approve` → модель прочитала файл задания и запросила **разрешение Bash `git -C …`** (в build команды git тоже требуют согласования) → второй approve → done. `hello.txt` только в рабочем дереве, основное дерево без изменений; `last.json` записал путь задания; usage около 65k (два запроса модели + чтение задания). Найден баг: после применения ответа `approve` при поиске квитанций событий падал на строке `{method,params}`, но завершался кодом 0 (исправлено T2.6) |
| **Сессии, в которых ещё не запускался ни один ход, нельзя возобновить** (2026-09-08, реальная T2.3b) | Сразу после `new` — `session/close` и выход процесса, затем `session/resume` runner сообщает `Session not found`. Как в проверках zcode-acp: для межпроцессного resume нужен хотя бы один ход. Собственный `sessionId` при `session/create` отклонён: «sessionId is only supported for imported history creates» |

## Проба файла учётных данных (2026-09-21, App 3.12.2, scripts/probe-credentials.mjs, ноль токенов)

Исходные факты T6-C проверены пробой на машине пользователя; шифрование и имена ключей взяты из открытого исходника ZCode 3.14.0, сверены с локальным форматом:

- Резервное получение ключа (sha256 от `zcode-credential-fallback:<platform>:<homedir>:<username>`) расшифровывает значения локального
  credentials.json (`ZCODE_CREDENTIAL_SECRET` не задан).
- `oauth:active_provider` = `bigmodel`; `oauth:bigmodel:user_info` расшифровывается в JSON с полями id, username, displayName, rawProfile.
- Ключи api-key личного и командного coding plan присутствуют, длина значений 49, содержат точку (форма `apiKey.secretKey`).
- Шифрование: `enc:v1:<iv>.<tag>.<密文>` (`<密文>` — шифротекст), три части base64url, AES-256-GCM, iv 12 байт, authTag 16 байт;
  значения без префикса используются как открытый текст.
- Имя ключа — внутренняя реализация App: `account-provider:coding-plan:account:<family>-<plan>-coding-plan:account:<encodeURIComponent(id)>:api-key`.
  После изменения станет нечитаемым, нужно явно сообщить «недоступно», а не продолжать молча (D19).

## Проба внепиковых задач (2026-09-27, App 3.14.1, CLI 0.16.9)

Факты из распаковки App (процессы host / scheduler в `app.asar`, `glm/zcode.cjs`) и локальных проб.
Скрипт остался в scratchpad сессии, не включён в репозиторий; два получения талона (использованы две бесплатные попытки), один очень маленький вызов модели.

| Проверка | Результат |
| --- | --- |
| Кто управляет внепиковой очередью | Процесс настольного хоста (`OffPeakTaskService`), не CLI. В CLI только инструменты модели `OffPeakCreate`/`OffPeakList`, подключаются при создании сессии с `offPeakToolEnabled:true`, вызов передаёт клиенту обратные запросы `offPeak/create`, `offPeak/list` |
| Сервер и авторизация | Рабочий origin `https://zcode.z.ai`, префикс `/api/v1/off-peak`; заголовки `Authorization: Bearer <JWT>` + `x-coding-plan-api-key: <账号 Coding Plan key>` (`账号 Coding Plan key` — ключ Coding Plan аккаунта). JWT хранится в credentials.json как `zcodejwttoken` (тот же AES-GCM), payload `user_id, token_version, sub, iat`, **без exp** |
| `GET /ticket/availability` (без расхода квоты) | `{code:0, data:{can_take_number:true}}`, при недоступности есть `next_take_at` |
| `POST /ticket {task_id}` | `{ticket_id, task_id, state:"queued", position, next_poll_after:90, queued_at}`. Первый талон на месте 1, второй — 15 |
| `POST /ticket/status {ticket_ids}` | Оба за 30–100 секунд стали `ready`, с `ready_deadline` (примерно queued_at + 310 секунд, **на запуск только около 5 минут**), `position:null` |
| `POST /ticket/<id>/settle` | Даже для истёкшего талона ответ 200, data сохраняет `state:"expired"` |
| Прямой fetch в `/anthropic/v1/messages` | Смена модели и сочетаний заголовков — всегда 400 `code 3001 parameter error`, причина не установлена; через CLI работает (две строки ниже), дальше не исследовалось |
| Обычный api-key-провайдер с внепиковым адресом | CLI требует клиентскую подпись для провайдеров на `z.ai`/`bigmodel.cn`, ключ подписи должен содержать одну точку («id.secret»), у JWT две → локально «Client signing credential must contain one separator», запрос не отправлен. Подпись не нужна только `zhipu-account` `off-peak`/`start-plan` (`wEs`) |
| Запись `zhipu-account` в персональном файле провайдера | Весь персональный файл перестаёт действовать, исчезают и обычные провайдеры (create сообщает отсутствие Model) |
| **Официальный внепиковый провайдер + updateAccountConfig (рабочий путь)** | Встроенный `account:<family>-offpeak-idle-plan` давно есть в CLI, но `entitled:false`. Передача `provider/updateAccountConfig {revision, basedOnZCodeBuiltinRevision, providers:{<id>:{access:{type:"zhipu-account", entitled:true}}}, states:{<id>:{availability:"available", entitled:true, current:true}}}` возвращает `received`. **`basedOnZCodeBuiltinRevision` должен быть `zcode-builtin:<内置文件 revision>:<sha256(内置文件绝对路径)>`** (ревизия встроенного файла и sha256 его абсолютного пути), при несовпадении CLI игнорирует всё (причина «передали, но не нашли» провайдера аккаунта в D19). Затем `session/send` с `modelSelection:{providerId:<id>, modelId, options:{reasoningLevel}}`, `modelExecution:{selectionScope:"execution", memoryExtraction:"skip", requestAuth:{apiKey:<JWT>, headers:{Authorization, X-Coding-Plan-Api-Key, X-Off-Peak-Ticket-ID}}, subagents:{foregroundModel:"submission", background:"deny"}}`, `offPeakTaskId`, `offPeakRunType:"init"` |
| Ход с истёкшим талоном (без расхода квоты) | Запрос действительно дошёл до zcode.z.ai, 400 `3102 off-peak ticket has expired or exceeded max running time`; code `turn.failed` — `3102`, message начинается `off-peak-ticket-expired:` (определение внепиковой ошибки CLI работает) |
| **Полный путь (второе получение талона)** | Место 15, через 30 секунд ready → передача конфигурации аккаунта → send «只回复两个字：收到» (ответь только двумя иероглифами 收到, «получено») → запрос `account:bigmodel-offpeak-idle-plan`/`GLM-5.3-Flash` завершён за 6.3 секунды, `turn.completed` `resultType:"success"`, response «收到» (получено), usage input 31619 / output 3. Затем талон `active`, `active_deadline` = первый запрос + **ровно 3 часа**, после settle `state:"settled"` |
| Фиктивный талон (без расхода квоты) | Реально 2026-09-27: `POST /ticket/status {ticket_ids:["1000000000000000000"]}` вернул `{code:0, data:{next_poll_after:90, tickets:[{ticket_id, state:"not_found", position:null}]}}`; после передачи полномочий ход с этим талоном дал `turn.failed`, `payload.error.code` `"3104"`, message «off-peak ticket is invalid» (stderr CLI — ProviderBusinessError, `providerCode: 3104`, HTTP 400). На этих двух вызовах основан полный слой doctor (повторная реальная OP3 дважды дала тот же результат) |
| Внепиковый провайдер без передачи полномочий | Ход `turn.failed`, у `turn.terminal` errorCode `provider_not_found`, `turnPhase: model_creation`, message «Provider Registry 中不存在 Provider: account:bigmodel-offpeak-idle-plan» (провайдера нет в Provider Registry) |
| Сессия deferred сохраняется после хода | Сессия `persistence:"deferred"` **сразу после отправки хода записывается** в таблицу `session` файла `~/.zcode/cli/db/db.sqlite` (только create + close без хода записи не оставляет, см. пробу 3.12.2 выше). v4 `deleteSession` возвращает `accepted`, но в исходнике вызывает лишь `closeSession` хоста, строка CLI не удаляется. Этих сессий нет в `tasks-index.sqlite` App, список задач их не видит. Реальный v4 `renameSession {title}` работает (после повторной OP3 заголовок в базе «zcode-executor doctor 闲时自检», внепиковая самопроверка) |
| Реальный doctor ⑤ (до слияния OP3) | `doctor --offpeak --json`: ok, код 0, stderr пуст, около 4 секунд; все семь строк полного doctor нормальны; подмена встроенного файла копией без внепиковой записи → «接口变了（内置条目…）» (API изменился, встроенная запись…), код 1; JWT и ключ в выводе отсутствуют |
| Контрольная точка 6a (2026-09-28, ветка offpeak 42c0d63) | Новая сессия (GLM-5.3-Flash), `send --offpeak`: место 9, готовность примерно за 1 минуту, ход done за 46 секунд, изменения верные; события taken/ready/started/settled полны, талон закрыт расчётом; все запросы модели хода через `account:bigmodel-offpeak-idle-plan`, только одна быстрая проверка шлюза — через обычный провайдер; в 5 файлах каталога runs JWT и ключ не найдены |
| Контрольная точка 6b | В той же сессии сначала обычная отправка доработки (done, offpeak.json не затронут), затем доработка `--offpeak`: исходный текст, `runType:"init"`, done, талон закрыт расчётом |
| Контрольная точка 6c (частично) | Внепиковый ход в ожидании по жёсткому правилу (запись /tmp) **выдержан 10 минут**, затем разрешён: через 6 секунд следующий шаг модели, талон действителен. Попытку на 40 минут прервал на 30-й минуте наш стандартный тайм-аут (`waitTimeoutSec` 1800 секунд, с начала хода, включая ожидание ответа), итог timeout, расчёт нормальный; **проверка не состоялась**, нужна повторная с `--timeout 5400` |
| Бесплатная квота получения талонов | После 3 успешных получений 2026-09-28 в 02:07–02:11 локального времени четвёртое дало 3103 «take number limit exceeded», `next_take_at` — следующий день 00:00 (локально, UTC+8). Накануне использовано 2. Предположение: **примерно 3 в день, сброс в полночь**; клиент переводит и сообщает местное время, код 2 (реальный путь пройден). Одна внепиковая отправка может использовать 3 талона, исчерпав дневную квоту |
| Запись requestAuth | После проб проверены файлы, записанные за последние 3 часа в `~/.zcode/cli` и tasks-index.sqlite, JWT и ключ плана не найдены |
| Коды ошибок (исходник) | Создание задачи: 3101 нет права, 3103 квота исчерпана (с `next_take_at`); выполнение: 3105 или HTTP 429 — ещё в очереди (CLI повторяет с увеличением задержки, не превышающей 5 минут между попытками), 3102/3001 — талон истёк (настольный клиент возвращается в очередь за новым, продолжение с фиксированным «Continue the previous task from where it left off…», `offPeakRunType:"resume"`) |

## Клиентская подпись Coding Plan (2026-09-28, App 3.14.1, CLI 0.16.9)

Скидка ZCode на расход Coding Plan (упомянутый пользователем множитель 0.67) не вычисляется клиентом, клиент лишь позволяет серверу узнать «это ZCode»:
- Переключатель: запрос `https://zcode.z.ai/api/v1/agent/configs` с ключом Coding Plan, подпись только если `data.codingPlanSignature.enable` равен true, результат кешируется на 1 час.
- Рукопожатие: ключ формы `id.secret`, POST `/api/paas/c1f3a7e2/v2/client` на домен модели, получение зашифрованного закрытого ключа и локальная расшифровка Ed25519.
- Каждый запрос модели к `bigmodel.cn`/`z.ai` (или провайдеру типа Coding Plan) дополняется `X-App-Id: zcode`, `X-Client-Version`, `X-Session-Id`, `X-Client-Ts`,
  `X-Client-Nonce`, `X-Client-Sig` (подпись id ключа, времени, версии, id сессии и случайного числа), `X-Client-Pow` (доказательство работы).
  Провайдеры аккаунта off-peak / start-plan освобождены от подписи (поэтому самодельный api-key внепиковый провайдер упирается в требование одной точки в ключе).
- **Наши обычные отправки подписываются**: `ZCODE_RUNTIME_ENV=development` (лишь отладочные логи, не смена сервера; сервер меняет `ZCODE_ENV`) + `ZCODE_LOG_DIR` на временный каталог;
  один `workspace/generateText` на 18 токенов с персональным файлом провайдера (providerId `zcode-executor`, адрес open.bigmodel.cn), в отладочном логе
  `feature_gate enabled:true` и `signed_sent {signedAttempt:1, providerId:"zcode-executor"}`. Ходы используют тот же модуль запросов модели, записей без подписи или с ошибкой подписи в логах нет.
- Множитель — правило сервера, в коде клиента нет 0.67, он не отображается.

## Одноразовый CLI (резервный путь)

`zcode --prompt "<text>" --json --mode build --cwd <dir> --resume <sess_> --attach <file> --disallowed-tools "Write Edit Bash"`.
Перечисленные в `--help` параметры `--allowed-tools` и `--max-turns` на 0.16.5 дают Unknown option.
zcode-open-bridge утверждает, что этот режим не читает модель конфигурации, нужны переменные окружения; актуальность не проверена.
Каждый вызов оставляет строку сессии в базе.

## Хранение и совместная работа с App

- Список задач App читает таблицу `tasks` в `~/.zcode/v2/tasks-index.sqlite`, **группируя по `workspace_key` (=cwd)**.
  Туда пишет только zcode-acp; прямой app-server не пишет, сессии не появляются в списке App.
- Тексты сессий — в `~/.zcode/cli/db/db.sqlite` (WAL, таблицы `session` / `message` / `part`,
  последние две имеют `sequence`). Дочерний `zcode-cli` App и наш app-server
  открывают один файл (проверено lsof).
- В `zcode.cjs` нет межпроцессной блокировки занятой сессии. SQLite сохраняет целостность файла; нарушится ли логика при управлении
  одной сессией из двух процессов, не проверено.

## Обзор zcode-acp-server

- В 0.27.3 всего 17,300 строк. Можно перенести: `backend/client.js`+`listener.js` (613, запуск процесса и сопоставление),
  `backend/resolve.js`+`credentials.js` (242), `config/provider-registry.js` (143),
  удаление дубликатов и ответы в `handlers/server-requests.js` (часть из 815), определение конца хода в `handlers/session.js`
  (две-три сотни из 2665 строк, поиск `STALE_FREEZE_MS`). Необязательный `tasks-index.js` (360).
- Не переносить: `lazy-sessions`, `translators/*` (преобразование событий в ACP), `options`, `extensions`,
  `remote`, TUI, `sandbox`, `replay`, `i18n`.
- Темп версий: 0.17.1 → 0.27.3 за два дня. В changelog «session-create incubates terminal REPL»
  происходит только в hub/удалённом пути. В 0.27.3 всё ещё нет `session/close` со стороны ACP.
- Исходник: `npm pack zcode-acp-server@0.27.3` либо 0.17.1 в кеше npx
  `~/.npm/_npx/c904e5833c2b97e0/node_modules/zcode-acp-server`.

## Расположение параметров инструментов и полей результата Bash (2026-10-02, App 3.14.1, ноль токенов, чтение локальных runs/)

- В scheduled-строке `tool.updated` есть `inputOmitted:true`, `inputRef:"model_stream"`, нет `input`; параметры в `model.streaming` с тем же `toolCallId`:
  у `kind:'tool_call'` поле `payload.input` содержит полные параметры (перед ним потоковые части `tool_input_start/delta/end`).
  Поэтому прежний `status`, искавший `file_path` только в `tool.updated`, с 3.12 всегда получал null в `file`.
- В result-строке `tool.updated` поле `result.success` равно true даже при ненулевом коде Bash (все 122 результата x_af149b61 равны true, за 30 последних сессий false не встречался);
  настоящий результат — в `result.perf.detail.command`: `exitCode`, `status:"failed"`.
- Текст ответа — `kind:'text_delta'` в `model.streaming`, размышления — `reasoning_delta` (объём примерно в десять с лишним раз больше ответа); `lastText` в `last.json`
  соединяет сообщения хода напрямую, без разделителя.
- Более 90% `events.jsonl` — телеметрия `v4/telemetry/event`, крупнейший локальный файл событий 121MB.

## Проверки аудита безопасности (2026-10-08, App 3.14.4, ноль токенов, только чтение локального zcode.cjs и локальные эксперименты)

Проверялся `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (упакованный единый файл), запросы не отправлялись.

| Факт | Подробности |
| --- | --- |
| Таблица инструментов записи | `isWriteTool` содержит `Write`, `Edit`, `ApplyPatch`, `Bash`; в `isReadOnlyTool` есть `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `TodoRead`, `TodoWrite` и др. `MultiEdit` не встречается ни разу (0) |
| Регистрация встроенных инструментов | `registerBuiltInTools` перебирает таблицу и регистрирует по `metadata.name`. Имена заданы и строками, и константами: `U1="WebFetch"`, `Oht="WebSearch"`, `jte="EvalWorkflowSnippet"` и др.; 17 буквальных записей по поиску лишь `metadata:{name:"…"}` — неполная таблица |
| `toolDenylist` | `session/create` превращает его в runtime `toolDisallowlist`; `registerBuiltInTools` пропускает запрещённые инструменты до регистрации. Псевдоним `web_search` нормализуется в `WebSearch`, поэтому `--deny "WebFetch WebSearch"` охватывает оба встроенных сетевых инструмента и этот псевдоним. Вывод из исходника, без хода модели; сеть Bash, js и MCP этими двумя именами не ограничивается |
| Инструменты рабочих процессов и внепиковых задач | `dynamicWorkflowEnabled`, `offPeakToolEnabled` app-server по умолчанию false, runner инструмента их не включает. `EvalWorkflowSnippet` относится к динамическим рабочим процессам, регистрируется первым переключателем; `OffPeakCreate` / `OffPeakList` нужен порт второго. Внепиковые отправки идут через параметры протокола, не через включение этих инструментов модели |
| `ApplyPatch` | В таблице регистрации этой локальной версии реализация не найдена. Schema входа `{patch_text: string}`, **нет `file_path`**, целевые пути в тексте патча, формат которого не выяснен. Механическое жёсткое правило всегда передаёт человеку (нет определяемого пути), извлечение добавится при появлении реального вызова |
| Инструмент `js` | Node REPL, вход `{code: string, timeout_ms?, title?}`, `needsApproval:true`, исходное описание разрешений «Node REPL can run arbitrary JavaScript with full Node privileges (require/process), like Bash». Поэтому самозащита шлюза смотрит и Bash `command`, и `code` |
| Резервные переменные окружения ключей модели | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — лишь резерв AI SDK, когда ключ не указан явно; инструмент использует персональный файл провайдера и runtime-заголовки, в окружении дочернего процесса они не нужны |

Локальные эксперименты (без zcode):

- `fs.realpathSync` Node v26.5.0 (реализация JS) сначала вызывает `path.resolve`, затем разбирает сегменты: `<dir>/link/../x` (`link` — символическая ссылка на другой каталог) даёт `<dir>/x`;
  `fs.writeFileSync` передаёт ядру исходную строку и пишет в родителя цели ссылки. Несовпадение — уязвимость D1 аудита, поэтому граница проверяется собственным разбором по сегментам.
- git 2.54.0: `git status --porcelain` для отслеживаемого файла с прежним размером и новым временем читает содержимое для сравнения, перед этим запускает `filter.<名字>.clean` из `.gitattributes` (`<名字>` — имя)
  (изменённый размер исключает сравнение содержимого и вызов). `-c core.fsmonitor=false` этим не управляет; установка `filter.<名字>.process` в пустую строку через `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`
  прекращает вызов (clean, smudge также перестают использоваться).

## Сторона Claude Code (сверка официальной документации)

- Плагин может содержать `skills/`, `bin/` (в PATH Bash во время включения), `.mcp.json`;
  `${CLAUDE_PLUGIN_ROOT}` — каталог установки, `${CLAUDE_PLUGIN_DATA}` — постоянные данные.
- Тайм-аут Bash по умолчанию 2 минуты, максимум 10 минут; по тайм-ауту команда уходит в фон и уведомляет Claude при завершении.
  Вызовы MCP дольше 2 минут (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`) также автоматически уходят в фон.
- MCP elicitation (формы / URL) поддерживается интерактивными сессиями, в `-p` и SDK вызов завершается ошибкой.
  Возможность показа после ухода в фон в документации не описана.
- Хуки PreToolUse и `--permission-prompt-tool` действуют лишь на собственные вызовы инструментов Claude.
- AskUserQuestion доступен интерактивно, `askUserQuestionTimeout` позволяет продолжить автоматически, в `dontAsk` недоступен.
- Скрипт `bin/` плагина через Bash проходит обычное согласование Bash, `Bash(zcode-executor *)` может входить в список разрешённых префиксов.

## Обзор сторонних проектов

| Проект | Язык | Подключение к zcode | Внешний интерфейс | Активность |
| --- | --- | --- | --- | --- |
| zcode-open-bridge (tizerluo) | Python без зависимостей | Прямой app-server, также `--prompt --json` | Мост ACP, инструмент проверки MCP, определение возможностей | Последний коммит 2026-08-31 |
| zcode-acp (william0wang) | TypeScript | Прямой app-server | Сервис ACP, TUI, удалённый hub | Несколько версий в день, README ссылается на open-bridge |
| coder-mcp-bridge (Deslord319) | Python без зависимостей | Прямой app-server (`zcode_protocol.py` 13KB) | Инструменты оркестрации MCP, три backend | Последний коммит 2026-08-15 |

Политика согласования coder-mcp-bridge: вне plan автоматически разрешает `requestPermission` (кроме записи в
корни exclusive), `requestUserInput` автоматически разрешает только plan_approval.

## Реальная проба отправок Start Plan (2026-09-29, App 3.14.1, CLI 0.16.9)

> `--start-plan` целиком удалён 2026-10-02 (decisions D21); ниже тогдашние результаты.

Полный путь `send --start-plan` (T8): передача полномочий, изменение маршрута каждого хода и runtime-заголовки хоста работают по замыслу, но **сервер блокирует ход на капче Alibaba Cloud**.

| Пункт | Результат |
| --- | --- |
| Передача полномочий | `provider/updateAccountConfig` (revision `zcode-executor-start-plan:*`) успешно передан, квитанция received |
| Маршрут send | `modelSelection.providerId = account:bigmodel-start-plan`, modelId GLM-5.3-Flash, запрос дошёл до `https://zcode.z.ai/api/v1/zcode-plan/anthropic` (подтверждён baseURL в отладочном `model.network.started`) |
| Ответ авторизации | Хост по providerId отвечает `{headersApplied:true, requestAuth:{apiKey:<zcodejwttoken>}}`; лог CLI `Client request signing skipped by provider access mode` (start-plan без подписи, как `wEs` в исходнике) |
| Ответ сервера | HTTP **400**, `captcha verify failed` (прикладная ошибка, reason классифицирован как auth_failed); повтор captcha-retry тоже 400. CLI повторно запрашивает только runtime-заголовки; без captcha token от хоста дальше не идёт |
| Сравнение | В то же время запросы start-plan настольного App работают (эта сессия на нём); хост App обрабатывает runtime-headers start-plan через UI (встроенный SDK капчи Alibaba Cloud, `x-aliyun-captcha-verify-param`), безголовый хост не создаёт такой заголовок. Standalone-порт CLI поддерживает лишь individual-coding-plan, для start-plan сразу ошибка: фактически канал start plan зависит от UI App |
| Вывод | Слой протокола реализован верно, проверен до исходящего запроса; капча шлюза сервера — внешнее ограничение. Обычные и внепиковые отправки не затронуты |

Причина зависания npm test внутри хост-сессии App (тот же день): переменные хоста `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE`,
`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` попадали в тесты, случай appserver.test.mjs «без переменных окружения должна быть ошибка» терял смысл,
тесты spawn действительно запускали app-server и не могли дождаться рукопожатия. Исправлено очисткой `ZCODE_*` хоста в начале appserver.test.mjs (сохранён `ZCODE_BIN`).

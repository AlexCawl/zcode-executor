# start plan 投递（zcode-executor 详细参考）

正文见 SKILL.md「start plan 投递」一节的入口指针；以下是完整细节，涉及这种投递方式时再读。

## start plan 投递

Start Plan 是 ZCode App 里的另一档订阅。`send <id> <正文> --start-plan` 让**这一回合**吃 Start Plan 额度，
其余与普通投递完全一样：立刻开跑、不独占会话、验收照旧。`--steer` 不能插进 start plan 投递
（它是一次新投递）。（2026-09-29 曾因阿里云验证码在无头宿主上不可用，
2026-10-09 服务器撤下验证后恢复。）

- 模型表以 ZCode App 的内置配置为准（被拒时退出码 2，报错会列出表）；会话模型不在表里就换 `--tier` 新建会话。
- 同一会话可以混用：有的投递带 `--start-plan`、有的不带，互不影响；失败也不影响后续普通投递。

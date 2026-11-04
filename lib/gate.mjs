// 本文件负责：闸门的两段编排——createGate 把机械红线（review/hard.mjs）与挂起（pending.mjs）
// 按固定顺序接起来，审批请求与提问都从这里走：红线命中 → 挂起带规则号；红线之外也一律挂起，
// 由人（主 agent 或用户）裁决。本 fork 没有模型审批段（LEAN-FORK.md）。
// 不负责：pending.json 的读写细节（pending.mjs）。
// 被依赖方：lib/run.mjs 的 runner 接线（工作流 → 闸门，RULES §1 允许的方向）。
// 依赖：同层 lib/pending.mjs、闸门层 lib/review/hard.mjs；不 import 工作流层（run/registry/config/cli）。
//
// 安全边界（RULES §8）：本文件不存在自动放行分支——唯一会应答出去的是人的决定（answer 轮询消费）。
import process from 'node:process';
import { createPendingGate, hasAllowOnce } from './pending.mjs';
import { checkHardRules } from './review/hard.mjs';

/**
 * 造闸门。纯机械：红线（越出执行副本、碰数据目录、调本工具 CLI）命中即挂起并带规则号；
 * 其余审批请求同样挂起，附一句话说明由人裁决。故障时默认安全（PRD 用户故事 19）。
 *
 * @param {object} opts
 * @param {string} opts.cwd 执行副本根（红线判界）
 * @param {object} opts.config 插件配置（home 是数据目录，红线靠它认「碰数据目录」，
 *   没有就只认得出「调本工具 CLI」）
 * @param {string} opts.pendingPath runs/<id>/pending.json
 * @param {(pending) => void} opts.onPending 挂起落盘后的回调（runner 用它装 answer 轮询）
 * @param {(event) => void} opts.appendEvent 事件落盘（executor.gate 各段结果）
 * @param {string[]} [opts.secrets] pending.json 落盘前按值抹掉的密钥（runner 手里的 provider key 等）
 */
export function createGate({ cwd, config, pendingPath, onPending, appendEvent, secrets }) {
  const pendingGate = createPendingGate({ pendingPath, onPending, secrets });

  async function permission(params) {
    // 整段兜底（T3.2b 评审）：闸门自己出错时挂起转人工，不能把异常应答成 -32603 让回合死掉
    try {
      // ① 机械红线：带路径参数的工具越出执行副本；操作指向本工具自己的数据目录（config.home）或 CLI
      //    （审计 D2：执行端与 runner 同一个用户，能自己写 answer.json、自己跑 approve）。
      //    命中即挂起，不判其他（PRD 第 6 节）
      const hard = checkHardRules({ toolName: params.toolName, input: params.input }, { cwd, stateDir: config?.home });
      if (hard.hit) {
        // 事件统一用 reason（T3.2b）；红线段的 why 只留在 pending.json 里
        appendEvent({ type: 'executor.gate', stage: 'hard', decision: 'ask', ruleId: hard.ruleId, reason: hard.why });
        return pendingGate.handlers.permission({ ...params, stage: 'hard', ruleId: hard.ruleId, why: hard.why });
      }
      // ② 放行的前提是 options 里真有 allow_once（RULES §8、pending.mjs 的 hasAllowOnce）：
      //    zcode 自己没给放行项时 approve 应答不了，这个信息要带给应答的人
      if (!hasAllowOnce(params)) {
        const reason = 'options 里没有 allow_once，不存在放行选项，转人工';
        appendEvent({ type: 'executor.gate', stage: 'no-allow-option', decision: 'ask', reason });
        return pendingGate.handlers.permission({ ...params, stage: 'no-allow-option', why: reason });
      }
      // ③ 红线之外：本 fork 不设自动放行，一律挂起等人（主 agent 按「退出码 5」流程应答）
      const reason = '机械闸门：无模型审批，转人工裁决';
      appendEvent({ type: 'executor.gate', stage: 'manual', decision: 'ask', reason });
      return pendingGate.handlers.permission({ ...params, stage: 'manual', why: reason });
    } catch (err) {
      const reason = `闸门内部错误，转人工：${err?.message ?? err}`;
      process.stderr.write(`gate: ${reason}\n`);
      try {
        appendEvent({ type: 'executor.gate', stage: 'gate-error', decision: 'ask', reason });
      } catch (eventErr) {
        // 事件写不进去也不能吞掉原始错误，stderr 已有一行可查
        process.stderr.write(`gate: gate-error 事件落盘失败：${eventErr?.message ?? eventErr}\n`);
      }
      return pendingGate.handlers.permission({ ...params, stage: 'gate-error', why: reason });
    }
  }

  async function question(params) {
    // 提问不进红线（D7）：直接挂起，主 agent 先答，答不了再问人。
    // 整段兜底与 permission 同款（T2.9 第 3 条）：出错也落 gate-error 事件后仍挂起，
    // 不把异常应答出去让回合死掉——故障时默认安全（PRD 用户故事 19）
    try {
      appendEvent({ type: 'executor.gate', stage: 'question', decision: 'ask', reason: '等人' });
      return pendingGate.handlers.question(params);
    } catch (err) {
      const reason = `闸门内部错误，转人工：${err?.message ?? err}`;
      process.stderr.write(`gate: ${reason}\n`);
      try {
        appendEvent({ type: 'executor.gate', stage: 'gate-error', decision: 'ask', reason });
      } catch (eventErr) {
        // 事件写不进去也不能吞掉原始错误，stderr 已有一行可查
        process.stderr.write(`gate: gate-error 事件落盘失败：${eventErr?.message ?? eventErr}\n`);
      }
      return pendingGate.handlers.question({ ...params, stage: 'gate-error', why: reason });
    }
  }

  return {
    handlers: { permission, question },
    answer: pendingGate.answer,
    current: pendingGate.current,
  };
}

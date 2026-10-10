/*
 * Report construction and rendering: Report object (JSON-ready), Chinese Markdown grouped by category, and the exit status rule (any error -> 1, warnings only -> 0).
 */
import { CATEGORIES } from './types.ts';
import type { Finding, Location, Report } from './types.ts';

export function makeReport(meta: Omit<Report, 'version' | 'summary' | 'findings'>, findings: Finding[]): Report {
  return {
    version: 1,
    ...meta,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
    },
    findings,
  };
}

export function exitCodeFor(report: Report): 0 | 1 {
  return report.summary.errors > 0 ? 1 : 0;
}

const SEVERITY_LABEL = { error: '错误', warning: '警告' } as const;

function describeLocation(location: Location): string {
  const parts: string[] = [];
  if (location.unit) parts.push(`单元 ${location.unit}`);
  if (location.layout) parts.push(`排法 ${location.layout}`);
  if (location.slot) parts.push(`槽位 ${location.slot}`);
  if (location.selector) parts.push(`\`${location.selector}\``);
  return parts.join(' · ') || '（无位置）';
}

export function reportToMarkdown(report: Report): string {
  const lines = [
    '# 检查报告',
    '',
    `- 体系：${report.system}`,
    `- 作品概念：${report.work.concept}`,
    `- 载体：${report.work.carrier}（${report.work.canvas}）`,
    `- 结果：${report.summary.errors} 个错误，${report.summary.warnings} 个警告`,
    '',
  ];
  if (report.findings.length === 0) {
    lines.push('没有发现。', '');
    return lines.join('\n');
  }
  for (const [category, label] of Object.entries(CATEGORIES)) {
    const group = report.findings.filter((finding) => finding.category === category);
    if (group.length === 0) continue;
    lines.push(`## ${label}（${group.length}）`, '');
    for (const finding of group) {
      lines.push(
        `### ${SEVERITY_LABEL[finding.severity]} \`${finding.ruleId}\``,
        '',
        `- 位置：${describeLocation(finding.location)}`,
        `- 说明：${finding.message}`,
        '',
      );
    }
  }
  return lines.join('\n');
}

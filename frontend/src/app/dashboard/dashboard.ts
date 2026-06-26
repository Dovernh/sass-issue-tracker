import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { map } from 'rxjs';

import { listResource } from '../api/list-resource';
import { IssueStatus } from '../api/proxies/issueTrackerAPI.schemas';
import { ThemeService } from '../core/theme.service';

/** Status code enum as an ordered array, for chart labels/order. */
const STATUSES = Object.values(IssueStatus);
import { IssueService } from '../api/proxies/issue/issue.service';
import { LanguageService } from '../core/language.service';
import { OptionLabelsService } from '../core/option-labels.service';

/** Slice colors (fixed; legible on both light and dark backgrounds). */
const STATUS_COLORS: Record<IssueStatus, string> = {
  open: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#22c55e',
  closed: '#6b7280',
};

/** Known priority colors; org-custom priorities fall back to the palette below. */
const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};
const FALLBACK_COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

@Component({
  selector: 'app-dashboard',
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly #translate = inject(TranslateService);
  readonly #language = inject(LanguageService);
  readonly #theme = inject(ThemeService);
  readonly #issueService = inject(IssueService);
  readonly #optionLabels = inject(OptionLabelsService);

  protected readonly issues = listResource(() =>
    this.#issueService.getIssues().pipe(map((res) => res.issues)),
  );

  // Org-configured priority list (cached, all locales), for chart labels/order.
  readonly #priorities = this.#optionLabels.priorities;
  protected readonly total = computed(() => this.issues.value().length);

  protected readonly statusChartData = computed<ChartData<'pie', number[], string>>(() => {
    this.#language.current();
    const counts = new Map<IssueStatus, number>(STATUSES.map((s) => [s, 0]));
    for (const issue of this.issues.value()) {
      counts.set(issue.status, (counts.get(issue.status) ?? 0) + 1);
    }
    return {
      labels: STATUSES.map((s) => this.#translate.instant(`issues.statuses.${s}`)),
      datasets: [
        {
          data: STATUSES.map((s) => counts.get(s) ?? 0),
          backgroundColor: STATUSES.map((s) => STATUS_COLORS[s]),
          borderWidth: 0,
        },
      ],
    };
  });

  protected readonly priorityChartData = computed<ChartData<'pie', number[], string>>(() => {
    this.#language.current();
    const options = this.#priorities.value();
    const counts = new Map<string, number>(options.map((o) => [o.key, 0]));
    for (const issue of this.issues.value()) {
      counts.set(issue.priority, (counts.get(issue.priority) ?? 0) + 1);
    }
    return {
      labels: options.map((o) => this.#optionLabels.label('priority', o.key)),
      datasets: [
        {
          data: options.map((o) => counts.get(o.key) ?? 0),
          backgroundColor: options.map(
            (o, i) => PRIORITY_COLORS[o.key] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          ),
          borderWidth: 0,
        },
      ],
    };
  });

  /** Text alternatives for the canvas charts (WCAG 1.1.1). */
  protected readonly statusSummary = computed(() => this.#summarize(this.statusChartData()));
  protected readonly prioritySummary = computed(() => this.#summarize(this.priorityChartData()));

  #summarize(data: ChartData<'pie', number[], string>): string {
    const labels = data.labels ?? [];
    const values = data.datasets[0]?.data ?? [];
    return labels.map((label, i) => `${label}: ${values[i] ?? 0}`).join(', ');
  }

  /** Timestamp shown on the printable report; refreshed each time you print. */
  protected readonly reportDate = signal('');

  /** Flat rows (metric/label/count) for the printable summary table. */
  protected readonly summaryRows = computed(() => {
    const rows: { key: string; metric: string; label: string; count: number }[] = [];
    const push = (metric: string, d: ChartData<'pie', number[], string>) => {
      (d.labels ?? []).forEach((label, i) => {
        rows.push({ key: `${metric}-${i}`, metric, label: String(label), count: d.datasets[0]?.data[i] ?? 0 });
      });
    };
    push(this.#translate.instant('issues.status'), this.statusChartData());
    push(this.#translate.instant('issues.priority'), this.priorityChartData());
    return rows;
  });

  protected print(): void {
    this.reportDate.set(new Date().toLocaleString());
    setTimeout(() => window.print(), 0);
  }

  /** Export the dashboard metrics (status + priority counts) as a CSV file. */
  protected exportCsv(): void {
    const rows: string[][] = [['Metric', 'Label', 'Count']];
    const add = (metric: string, d: ChartData<'pie', number[], string>): void => {
      (d.labels ?? []).forEach((label, i) => {
        rows.push([metric, String(label), String(d.datasets[0]?.data[i] ?? 0)]);
      });
    };
    add('Status', this.statusChartData());
    add('Priority', this.priorityChartData());
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected readonly chartOptions = computed<ChartOptions<'pie'>>(() => {
    const textColor = this.#theme.theme() === 'dark' ? '#e7ebf0' : '#161a1f';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: textColor } } },
    };
  });
}

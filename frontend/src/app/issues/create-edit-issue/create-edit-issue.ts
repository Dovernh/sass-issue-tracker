import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { form, required } from '@angular/forms/signals';
import { firstValueFrom, map } from 'rxjs';

import { listResource } from '../../api/list-resource';
import { IssueService } from '../../api/proxies/issue/issue.service';
import { type Issue } from '../../api/proxies/issueTrackerAPI.schemas';
import { MemberService } from '../../api/proxies/member/member.service';
import { NotificationService } from '../../core/notification.service';
import { OptionLabelsService } from '../../core/option-labels.service';
import { RichTextEditor } from '../../shared/components/rich-text-editor/rich-text-editor';
import { FORM_IMPORTS } from '../../shared/form-imports';
import { CreateEditIssueData } from './create-edit-issue-data';

@Component({
  selector: 'app-create-edit-issue',
  imports: [...FORM_IMPORTS, RichTextEditor],
  templateUrl: './create-edit-issue.html',
  styleUrl: './create-edit-issue.scss',
})
export class CreateEditIssue {
  readonly #issueService = inject(IssueService);
  readonly #memberService = inject(MemberService);
  protected readonly optionLabels = inject(OptionLabelsService);
  readonly #notify = inject(NotificationService);

  readonly selectedIssue = input<Issue | null>(null);
  readonly added = output<boolean>();
  readonly cancelled = output<void>();

  readonly #model = linkedSignal<CreateEditIssueData>(() => {
    const issue = this.selectedIssue();
    return {
      description: issue?.description ?? '',
      priority: issue?.priority ?? 'medium',
      category: issue?.category ?? 'other',
      assignedUser: issue?.assignedUser ?? '',
    };
  });

  protected readonly members = listResource(() =>
    this.#memberService.getMembers().pipe(map((res) => res.members)),
  );

  // Priority/category option lists (cached, all locales) come from the service.
  protected readonly priorities = this.optionLabels.priorities;
  protected readonly categories = this.optionLabels.categories;

  protected createForm = form(
    this.#model,
    (s) => {
      required(s.description, { message: 'Description is required' });
    },
    {
      submission: {
        action: async (f) => {
          const v = f().value();
          const issue = this.selectedIssue();
          try {
            if (issue) {
              await firstValueFrom(
                this.#issueService.updateIssue(issue.id, {
                  description: v.description,
                  priority: v.priority,
                  category: v.category,
                  assignedUser: v.assignedUser || undefined,
                }),
              );

              this.#notify.success('Issue updated.');
            } else {
              await firstValueFrom(
                this.#issueService.postIssue({
                  description: v.description,
                  priority: v.priority,
                  category: v.category,
                  assignedUser: v.assignedUser || undefined,
                }),
              );

              this.#notify.success('Issue created.');
            }

            this.added.emit(true);
          } catch {
            // The error interceptor already surfaced the failure as a toast.
          }
        },
      },
    },
  );
}

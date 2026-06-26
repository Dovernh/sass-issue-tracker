import { FormField, FormRoot } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';

import { FieldError } from './field-error';

export const FORM_IMPORTS = [FormRoot, FormField, FieldError, TranslatePipe] as const;

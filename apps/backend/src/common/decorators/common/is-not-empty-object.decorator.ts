// src/common/decorators/common/is-not-empty-object.decorator.ts

import type { ValidationOptions, ValidationArguments } from 'class-validator';
import { registerDecorator } from 'class-validator';

export function IsNotEmptyObject(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotEmptyObject',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Exclude the 'data' property itself from the check
          const keys = Object.keys(args.object).filter((key) => key !== propertyName);
          return keys.length > 0;
        },
        defaultMessage() {
          return 'At least one field must be provided';
        },
      },
    });
  };
}

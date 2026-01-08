import { Injectable } from '@nestjs/common';
import { EntityTypeOptions } from '@libs/data/type/entity-type.enum';
import { PermissionLevelOptions } from '@libs/data/type/permission-level.enum';
import { PermissionDto } from '../../dto/update-role.dto';

type GetPermissionOption = {
  entityType: EntityTypeOptions;
  permissions: PermissionLevelOptions[];
};

@Injectable()
export class PermissionFactory {
  constructor() {}

  GetPermissionDtos(options: GetPermissionOption[]): PermissionDto[] {
    return options.flatMap(({ entityType, permissions }) =>
      permissions.map((permission) => ({
        entityType,
        permission,
      })),
    );
  }
}

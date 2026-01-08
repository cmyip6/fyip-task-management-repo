import { Test, TestSuite } from '../modules/jest-test.decorator';
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { BaseTest } from './base-test';
import { UserSuite } from './user.suite';
import { RoleFactory, TaskFactory } from '../factory';
import { TaskStatusOptions } from '@libs/data/type/task-status.enum';
import { EntityTypeOptions } from '@libs/data/type/entity-type.enum';
import { PermissionLevelOptions } from '@libs/data/type/permission-level.enum';
import { PermissionFactory } from '../factory/permission.factory';
import { UpdateResult } from 'typeorm';
import { PermissionEntity } from '../../models/permissions.entity';

@Injectable()
@TestSuite('Permission Suite')
export class PermissionSuite extends BaseTest implements OnModuleInit {
  private readonly logger = new Logger(PermissionSuite.name);
  organizationId: number;
  roleId: number;
  cookies: {
    [key: string]: string;
  };

  @Inject(TaskFactory) taskFactory: TaskFactory;
  @Inject(RoleFactory) roleFactory: RoleFactory;
  @Inject(PermissionFactory) permissionFactory: PermissionFactory;

  constructor(@Inject(UserSuite) private readonly userSuite: UserSuite) {
    super();
  }

  onModuleInit(): void {
    this.logger.debug('Task Suite initialized');
    this.setUrl('/task');
  }

  @Test('Policy Guards')
  async createTask(): Promise<void> {
    const { loginDto, organization, role } = await this.userSuite.createUser();
    const cookies = await this.login(loginDto);
    this.payload = {
      organizationId: organization.id,
      roleId: role.id,
      cookies,
    };

    this.logger.debug('Create task should fail without permission');
    const createTaskDto = this.taskFactory.createFakeTaskDto(organization.id);
    await this.post(``, createTaskDto, cookies).expect(HttpStatus.FORBIDDEN);

    this.logger.debug('Assigning read permission to role');
    await this.assignPermissionToRole(EntityTypeOptions.ORGANIZATION, {
      insert: [PermissionLevelOptions.READ],
    });

    this.logger.debug(
      'Create task should still fail without update permission',
    );
    await this.post(``, createTaskDto, cookies).expect(HttpStatus.FORBIDDEN);

    this.logger.debug('Assigning update and create permission to role');
    await this.assignPermissionToRole(EntityTypeOptions.ORGANIZATION, {
      insert: [PermissionLevelOptions.UPDATE],
    });

    this.logger.debug('Create task should succeed');
    const { body: createTaskReponse } = await this.post(
      ``,
      createTaskDto,
      cookies,
    ).expect(HttpStatus.CREATED);
    expect(createTaskReponse.id).toBeDefined();
    expect(createTaskReponse.title).toBe(createTaskDto.title);
    expect(createTaskReponse.description).toBe(createTaskDto.description);
    expect(createTaskReponse.status).toBe(TaskStatusOptions.OPEN);

    this.logger.debug('Update task should fail without task update permission');
    const updateTaskDto = this.taskFactory.updateFakeTaskDto();
    await this.patch(`${createTaskReponse.id}`, updateTaskDto, cookies).expect(
      HttpStatus.FORBIDDEN,
    );

    this.logger.debug('Assigning task update permission to role');
    await this.assignPermissionToRole(EntityTypeOptions.TASK, {
      insert: [PermissionLevelOptions.UPDATE],
    });

    this.logger.debug('Update task should succeed');
    const { body: updateReponse }: { body: UpdateResult } = await this.patch(
      `${createTaskReponse.id}`,
      updateTaskDto,
      cookies,
    ).expect(HttpStatus.OK);
    expect(updateReponse.affected).toBe(1);
  }

  // helper functions
  set payload(data: {
    organizationId: number;
    roleId: number;
    cookies: {
      [key: string]: string;
    };
  }) {
    this.organizationId = data.organizationId;
    this.roleId = data.roleId;
    this.cookies = data.cookies;
  }

  private async assignPermissionToRole(
    entityType: EntityTypeOptions,
    options: {
      insert?: PermissionLevelOptions[];
      delete?: PermissionLevelOptions[];
    },
  ): Promise<void> {
    const updateRoleDto = this.roleFactory.updateRolePermissionDto(
      this.organizationId,
      {
        ...(options?.insert
          ? {
              insert: this.permissionFactory.GetPermissionDtos([
                {
                  entityType,
                  permissions: options.insert,
                },
              ]),
            }
          : {}),
        ...(options?.delete
          ? {
              delete: this.permissionFactory.GetPermissionDtos([
                {
                  entityType,
                  permissions: options.delete,
                },
              ]),
            }
          : {}),
      },
    );
    const { body: updateResponse } = await this.patch(
      `/role/${this.roleId}/permission`,
      updateRoleDto,
      this.cookies,
    ).expect(HttpStatus.OK);
    expect(updateResponse).toBeDefined();
  }
}

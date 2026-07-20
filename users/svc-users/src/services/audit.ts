import { ddbDocClient, TABLE_NAME } from '../db.js';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ActionType } from '@project-tracker/shared-types';

export interface AuditLogParams {
  orgId: string;
  userId: string;
  actionType: ActionType;
  targetUserId?: string;
  oldValue?: any;
  newValue?: any;
  changeReason?: string;
  ipAddress?: string;
}

/**
 * Immutable DynamoDB audit log.
 * PK = ORG#<orgId>  SK = AUDIT#<timestamp>#<auditId>
 * GSI1PK = USER#<userId>  GSI1SK = ACTION#<timestamp>
 */
export class AuditLogService {
  static async log(params: AuditLogParams): Promise<string> {
    const auditId = uuidv4();
    const timestamp = new Date().toISOString();

    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `ORG#${params.orgId}`,
        SK: `AUDIT#${timestamp}#${auditId}`,
        GSI1PK: `USER#${params.userId}`,
        GSI1SK: `ACTION#${timestamp}`,
        auditId,
        orgId: params.orgId,
        userId: params.userId,
        actionType: params.actionType,
        targetUserId: params.targetUserId,
        oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : undefined,
        newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : undefined,
        changeReason: params.changeReason,
        ipAddress: params.ipAddress,
        timestamp,
      },
    }));

    return auditId;
  }

  /**
   * Fetch audit logs for an organization (most recent first).
   */
  static async getOrgLogs(orgId: string, limit = 100): Promise<any[]> {
    const { Items } = await ddbDocClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${orgId}`,
        ':sk': 'AUDIT#',
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    }));

    return (Items || []).map(item => ({
      ...item,
      oldValue: item.oldValue ? JSON.parse(item.oldValue) : undefined,
      newValue: item.newValue ? JSON.parse(item.newValue) : undefined,
    }));
  }
}

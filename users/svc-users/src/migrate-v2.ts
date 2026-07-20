import { ddbDocClient, TABLE_NAME } from './db.js';
import { ScanCommand, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { UserStatus, TwoFactorMethod } from '@project-tracker/shared-types';

async function migrate() {
  console.log('Starting migration to Schema V2...');

  // 1. Fetch all users
  const { Items: users } = await ddbDocClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":sk": "USER#"
    }
  }));

  if (!users || users.length === 0) {
    console.log('No users found to migrate.');
    return;
  }

  console.log(`Found ${users.length} users. Updating records...`);

  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  for (const user of users) {
    const orgId = user.PK.split('#')[1];
    
    // Update user record with new fields
    const updatedUser = {
      ...user,
      status: user.status || UserStatus.ACTIVE,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      twoFactorMethod: user.twoFactorMethod ?? TwoFactorMethod.NONE,
      credentialsExpiryDate: user.credentialsExpiryDate || expiry,
      loginAttempts: user.loginAttempts ?? 0,
      createdAt: user.createdAt || now,
      updatedAt: now
    };

    // Save updated user
    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedUser
    }));

    // Create Email-Role Mapping
    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `ORG#${orgId}`,
        SK: `EMAIL_ROLE#${user.email}#${user.role}`,
        email: user.email,
        role: user.role,
        assignedUserId: user.userId,
        isActive: true,
        createdAt: now
      }
    }));

    console.log(`Migrated user: ${user.email}`);
  }

  console.log('Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

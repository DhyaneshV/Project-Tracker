import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'ap-south-1';
const client = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true, convertClassInstanceToMap: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'ProjectTracker';

async function updatePassword(email: string, newPassword: string) {
    try {
        let users: Record<string, any>[] = [];
        // Current records use EMAIL#; older seed data used USER_EMAIL#.
        for (const key of [`EMAIL#${email}`, `USER_EMAIL#${email}`]) {
            const result = await ddbDocClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'GSI1',
                KeyConditionExpression: "GSI1PK = :pk",
                ExpressionAttributeValues: { ":pk": key }
            }));
            if (result.Items?.length) {
                users = result.Items;
                break;
            }
        }

        if (!users || users.length === 0) {
            console.error("User not found.");
            return;
        }

        const user = users[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await ddbDocClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: user.PK, SK: user.SK },
            UpdateExpression: "SET password = :p",
            ExpressionAttributeValues: { ":p": hashedPassword }
        }));

        console.log(`Password for ${email} updated successfully.`);
    } catch (err) {
        console.error("Error updating password:", err);
    }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
    console.error("Usage: npx tsx src/update-pwd.ts <email> <newPassword>");
    process.exit(1);
}

updatePassword(email, password);

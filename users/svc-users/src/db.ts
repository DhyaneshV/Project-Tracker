import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'ap-south-1';

const client = new DynamoDBClient({ region });

export const ddbDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
        convertClassInstanceToMap: true,
    },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'ProjectTracker';

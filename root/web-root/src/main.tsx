import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, from, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NetworkStatusBar } from './components/NetworkStatus';
import App from './App';
import './globals.css';

const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000/graphql';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const httpLink = createHttpLink({
  uri: gatewayUrl,
  credentials: 'include', // Send cookies (refresh token) with requests
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// ─── Token Refresh Logic ────────────────────────────────────────

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

function resolvePendingRequests() {
  pendingRequests.forEach((cb) => cb());
  pendingRequests = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send httpOnly cookie
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

// Error link: intercepts auth errors and silently refreshes
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    const hasAuthError = graphQLErrors.some(
      (err) =>
        err.extensions?.code === 'UNAUTHENTICATED' ||
        err.message.includes('authenticated') ||
        err.message.includes('Unauthorized') ||
        err.message.includes('jwt expired')
    );

    if (hasAuthError) {
      // If we're already refreshing, queue this request
      if (isRefreshing) {
        return new Observable((observer) => {
          pendingRequests.push(() => {
            const token = localStorage.getItem('token');
            const oldHeaders = operation.getContext().headers;
            operation.setContext({
              headers: { ...oldHeaders, authorization: token ? `Bearer ${token}` : '' },
            });
            forward(operation).subscribe(observer);
          });
        });
      }

      isRefreshing = true;

      return new Observable((observer) => {
        refreshAccessToken()
          .then((newToken) => {
            if (newToken) {
              // Retry the failed request with new token
              const oldHeaders = operation.getContext().headers;
              operation.setContext({
                headers: { ...oldHeaders, authorization: `Bearer ${newToken}` },
              });
              resolvePendingRequests();
              forward(operation).subscribe(observer);
            } else {
              // Refresh failed — clear token, let App.tsx handle redirect to login
              localStorage.removeItem('token');
              resolvePendingRequests();
              observer.error(graphQLErrors[0]);
            }
          })
          .catch(() => {
            localStorage.removeItem('token');
            resolvePendingRequests();
            observer.error(graphQLErrors[0]);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }
  }

  // For network errors (non-auth), let them propagate
  if (networkError) {
    console.error('[Network Error]', networkError);
  }
});

// ─── Apollo Client ──────────────────────────────────────────────

const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Merge incoming getAllUsers with existing cache (by ID)
          getAllUsers: {
            merge(_, incoming) { return incoming; },
          },
          getPayrollHistory: {
            merge(_, incoming) { return incoming; },
          },
          getAuditLogs: {
            merge(_, incoming) { return incoming; },
          },
        },
      },
      // Ensure proper object identification for cache updates
      User: { keyFields: ['id'] },
      Project: { keyFields: ['id'] },
      Task: { keyFields: ['id'] },
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <NetworkStatusBar />
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

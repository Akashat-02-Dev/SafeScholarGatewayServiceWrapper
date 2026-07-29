'use client';

import { useCallback, useState } from 'react';

import gatewayClient from '@/lib/gateway/gatewayClient';
import type { GatewayResponse } from '@/lib/types/gateway';

interface UseGatewayState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  meta: GatewayResponse<T> extends { meta: infer M } ? M : never;
}

interface UseGatewayReturn<T, TReq> extends UseGatewayState<T> {
  execute: (req: TReq) => Promise<GatewayResponse<T>>;
  reset: () => void;
}

/**
 * Generic hook that wraps a gatewayClient method and exposes
 * loading / error / data state for React components.
 */
function useGatewayCall<T, TReq>(
  fn: (req: TReq, signal?: AbortSignal) => Promise<GatewayResponse<T>>,
): UseGatewayReturn<T, TReq> {
  const [state, setState] = useState<UseGatewayState<T>>({
    data: null,
    loading: false,
    error: null,
    meta: {} as UseGatewayState<T>['meta'],
  });

  const execute = useCallback(
    async (req: TReq): Promise<GatewayResponse<T>> => {
      setState((s) => ({ ...s, loading: true, error: null }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      try {
        const res = await fn(req, controller.signal);

        if (res.ok) {
          setState({ data: res.data, loading: false, error: null, meta: res.meta });
        } else {
          setState({
            data: null,
            loading: false,
            error: res.error.message,
            meta: res.meta,
          });
        }
        return res;
      } catch (err) {
        const msg = (err as Error).name === 'AbortError' ? 'Request timed out' : (err as Error).message;
        setState({ data: null, loading: false, error: msg, meta: {} as UseGatewayState<T>['meta'] });
        return {
          ok: false,
          error: { code: 'CLIENT_ERROR', message: msg },
          meta: { requestId: 'client', provider: 'unknown', latencyMs: 0, cached: false, timestamp: new Date().toISOString() },
        };
      } finally {
        clearTimeout(timeout);
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, meta: {} as UseGatewayState<T>['meta'] });
  }, []);

  return { ...state, execute, reset };
}

// ---------------------------------------------------------------------------
// Specialised hooks
// ---------------------------------------------------------------------------

export function useLessonPlanner() {
  return useGatewayCall(gatewayClient.generateLessonPlan);
}

export function useQuizGenerator() {
  return useGatewayCall(gatewayClient.generateQuiz);
}

export function useFlashcardGenerator() {
  return useGatewayCall(gatewayClient.generateFlashcards);
}

export function useScraper() {
  return useGatewayCall(gatewayClient.scrape);
}

export function useTranslator() {
  return useGatewayCall(gatewayClient.translate);
}

export function useSocraticChat() {
  return useGatewayCall(gatewayClient.socraticChat);
}

-- Renombrar tabla clients a asociados
ALTER TABLE IF EXISTS public.clients RENAME TO asociados;

-- Renombrar tabla cost_centers a centros_costo
ALTER TABLE IF EXISTS public.cost_centers RENAME TO centros_costo;

-- Renombrar columnas client_id a asociado_id en todas las tablas relacionadas
DO $$
BEGIN
    -- motorcycles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motorcycles' AND column_name = 'client_id') THEN
        ALTER TABLE public.motorcycles RENAME COLUMN client_id TO asociado_id;
    END IF;

    -- payments
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'client_id') THEN
        ALTER TABLE public.payments RENAME COLUMN client_id TO asociado_id;
    END IF;

    -- deactivations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deactivations' AND column_name = 'client_id') THEN
        ALTER TABLE public.deactivations RENAME COLUMN client_id TO asociado_id;
    END IF;

    -- notifications
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'client_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN client_id TO asociado_id;
    END IF;
    
    -- daily_status (si existe)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_status' AND column_name = 'client_id') THEN
        ALTER TABLE public.daily_status RENAME COLUMN client_id TO asociado_id;
    END IF;

    -- asociados: renombrar cost_center_id a centro_costo_id si aplica
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asociados' AND column_name = 'cost_center_id') THEN
        ALTER TABLE public.asociados RENAME COLUMN cost_center_id TO centro_costo_id;
    END IF;
END $$;

-- Políticas RLS para permitir acceso a usuarios autenticados
DO $$
BEGIN
    -- motorcycles
    ALTER TABLE IF EXISTS public.motorcycles ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motorcycles' AND policyname = 'motorcycles_authenticated_select'
    ) THEN
        CREATE POLICY motorcycles_authenticated_select ON public.motorcycles
            FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motorcycles' AND policyname = 'motorcycles_authenticated_insert'
    ) THEN
        CREATE POLICY motorcycles_authenticated_insert ON public.motorcycles
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motorcycles' AND policyname = 'motorcycles_authenticated_update'
    ) THEN
        CREATE POLICY motorcycles_authenticated_update ON public.motorcycles
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motorcycles' AND policyname = 'motorcycles_authenticated_delete'
    ) THEN
        CREATE POLICY motorcycles_authenticated_delete ON public.motorcycles
            FOR DELETE TO authenticated USING (true);
    END IF;

    -- payments
    ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_authenticated_select'
    ) THEN
        CREATE POLICY payments_authenticated_select ON public.payments
            FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_authenticated_insert'
    ) THEN
        CREATE POLICY payments_authenticated_insert ON public.payments
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_authenticated_update'
    ) THEN
        CREATE POLICY payments_authenticated_update ON public.payments
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_authenticated_delete'
    ) THEN
        CREATE POLICY payments_authenticated_delete ON public.payments
            FOR DELETE TO authenticated USING (true);
    END IF;
END $$;
-- Actualizar Foreign Keys (si es necesario recrearlas o renombrarlas para claridad)
-- Nota: En PostgreSQL al renombrar la columna, la FK se mantiene pero con el nombre antiguo.
-- Es recomendable renombrar las constraints también para mantener consistencia.

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT conname, conrelid::regclass AS tablename 
             FROM pg_constraint 
             WHERE conname LIKE '%client%' AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE ' || r.tablename || ' RENAME CONSTRAINT ' || quote_ident(r.conname) || ' TO ' || quote_ident(REPLACE(r.conname, 'client', 'asociado'));
    END LOOP;
END $$;

-- Crear Foreign Keys faltantes para que PostgREST descubra las relaciones
DO $$
BEGIN
    -- motorcycles.asociado_id -> asociados.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'motorcycles_asociado_id_fkey'
    ) THEN
        ALTER TABLE public.motorcycles
        ADD CONSTRAINT motorcycles_asociado_id_fkey
        FOREIGN KEY (asociado_id) REFERENCES public.asociados(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    -- payments.asociado_id -> asociados.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_asociado_id_fkey'
    ) THEN
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_asociado_id_fkey
        FOREIGN KEY (asociado_id) REFERENCES public.asociados(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    -- deactivations.asociado_id -> asociados.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'deactivations_asociado_id_fkey'
    ) THEN
        ALTER TABLE public.deactivations
        ADD CONSTRAINT deactivations_asociado_id_fkey
        FOREIGN KEY (asociado_id) REFERENCES public.asociados(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    -- notifications.asociado_id -> asociados.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'notifications_asociado_id_fkey'
    ) THEN
        ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_asociado_id_fkey
        FOREIGN KEY (asociado_id) REFERENCES public.asociados(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    -- daily_status.asociado_id -> asociados.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'daily_status_asociado_id_fkey'
    ) THEN
        ALTER TABLE public.daily_status
        ADD CONSTRAINT daily_status_asociado_id_fkey
        FOREIGN KEY (asociado_id) REFERENCES public.asociados(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    -- asociados.centro_costo_id -> centros_costo.id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'asociados_centro_costo_id_fkey'
    ) THEN
        ALTER TABLE public.asociados
        ADD CONSTRAINT asociados_centro_costo_id_fkey
        FOREIGN KEY (centro_costo_id) REFERENCES public.centros_costo(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

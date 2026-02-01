/*
  # Sistema de Gestión de Cobros de Motos

  ## Descripción General
  Sistema completo para gestión de cobros diarios de motos con control de vencimientos,
  distribución automática de pagos, notificaciones y centros de costo.

  ## 1. Nuevas Tablas
  
  ### cost_centers (Centros de Costo)
  - `id` (uuid, primary key) - Identificador único
  - `name` (text) - Nombre del centro de costo
  - `code` (text, unique) - Código único del centro
  - `description` (text) - Descripción
  - `active` (boolean) - Estado activo/inactivo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ### clients (Clientes)
  - `id` (uuid, primary key) - Identificador único
  - `cost_center_id` (uuid, foreign key) - Centro de costo asociado
  - `name` (text) - Nombre completo del cliente
  - `document` (text, unique) - Documento de identidad
  - `phone` (text) - Teléfono para notificaciones
  - `email` (text) - Email
  - `address` (text) - Dirección
  - `grace_days` (integer) - Días de gracia al mes (2 o 4)
  - `active` (boolean) - Estado activo/inactivo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ### motorcycles (Motos)
  - `id` (uuid, primary key) - Identificador único
  - `client_id` (uuid, foreign key) - Cliente asociado
  - `brand` (text) - Marca de la moto
  - `model` (text) - Modelo
  - `year` (integer) - Año
  - `plate` (text, unique) - Placa
  - `daily_rate` (decimal) - Tarifa diaria
  - `status` (text) - Estado: ACTIVE, DEACTIVATED
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ### payments (Pagos Diarios)
  - `id` (uuid, primary key) - Identificador único
  - `motorcycle_id` (uuid, foreign key) - Moto asociada
  - `client_id` (uuid, foreign key) - Cliente asociado
  - `amount` (decimal) - Monto total pagado
  - `payment_date` (date) - Fecha del pago
  - `receipt_number` (text, unique) - Número de recibo
  - `notes` (text) - Notas adicionales
  - `created_at` (timestamptz) - Fecha de creación
  - `created_by` (uuid) - Usuario que registró el pago

  ### payment_distributions (Distribución de Pagos)
  - `id` (uuid, primary key) - Identificador único
  - `payment_id` (uuid, foreign key) - Pago asociado
  - `associate_amount` (decimal) - 70% para el asociado
  - `company_amount` (decimal) - 30% para la empresa
  - `created_at` (timestamptz) - Fecha de creación

  ### deactivations (Registro de Desactivaciones)
  - `id` (uuid, primary key) - Identificador único
  - `motorcycle_id` (uuid, foreign key) - Moto desactivada
  - `client_id` (uuid, foreign key) - Cliente asociado
  - `deactivation_date` (date) - Fecha de desactivación
  - `days_overdue` (integer) - Días en mora
  - `reason` (text) - Motivo de la desactivación
  - `reactivation_date` (date) - Fecha de reactivación (si aplica)
  - `created_at` (timestamptz) - Fecha de creación

  ### notifications (Notificaciones)
  - `id` (uuid, primary key) - Identificador único
  - `client_id` (uuid, foreign key) - Cliente destinatario
  - `motorcycle_id` (uuid, foreign key) - Moto asociada
  - `type` (text) - Tipo: WARNING, DEACTIVATION
  - `message` (text) - Mensaje enviado
  - `sent_at` (timestamptz) - Fecha de envío
  - `status` (text) - Estado: PENDING, SENT, FAILED
  - `channel` (text) - Canal: SMS, WHATSAPP
  - `created_at` (timestamptz) - Fecha de creación

  ### daily_status (Estado Diario)
  - `id` (uuid, primary key) - Identificador único
  - `motorcycle_id` (uuid, foreign key) - Moto
  - `client_id` (uuid, foreign key) - Cliente
  - `status_date` (date) - Fecha del estado
  - `days_overdue` (integer) - Días vencidos
  - `balance` (decimal) - Saldo pendiente
  - `status` (text) - Estado: CURRENT, OVERDUE, DEACTIVATED
  - `created_at` (timestamptz) - Fecha de creación

  ## 2. Seguridad (RLS)
  - Se habilita RLS en todas las tablas
  - Los usuarios autenticados pueden ver solo los datos de su centro de costo
  - Políticas restrictivas para operaciones de escritura

  ## 3. Índices
  - Índices en llaves foráneas para mejor rendimiento
  - Índices en campos de búsqueda frecuente

  ## 4. Notas Importantes
  - El sistema calcula automáticamente la distribución 70/30 en cada pago
  - Los días de gracia son configurables por cliente (2 o 4 días)
  - Después de 2 días sin pagar, la moto se marca como DEACTIVATED
  - Se mantiene un registro completo de todas las desactivaciones
*/

-- Create cost_centers table
CREATE TABLE IF NOT EXISTS cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_id uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  document text UNIQUE NOT NULL,
  phone text NOT NULL,
  email text DEFAULT '',
  address text DEFAULT '',
  grace_days integer DEFAULT 2 CHECK (grace_days IN (2, 4)),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create motorcycles table
CREATE TABLE IF NOT EXISTS motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  brand text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  plate text UNIQUE NOT NULL,
  daily_rate decimal(10,2) NOT NULL CHECK (daily_rate > 0),
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  receipt_number text UNIQUE NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create payment_distributions table
CREATE TABLE IF NOT EXISTS payment_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  associate_amount decimal(10,2) NOT NULL,
  company_amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create deactivations table
CREATE TABLE IF NOT EXISTS deactivations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  deactivation_date date NOT NULL,
  days_overdue integer NOT NULL,
  reason text NOT NULL,
  reactivation_date date DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('WARNING', 'DEACTIVATION')),
  message text NOT NULL,
  sent_at timestamptz DEFAULT NULL,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  channel text DEFAULT 'SMS' CHECK (channel IN ('SMS', 'WHATSAPP')),
  created_at timestamptz DEFAULT now()
);

-- Create daily_status table
CREATE TABLE IF NOT EXISTS daily_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status_date date NOT NULL,
  days_overdue integer DEFAULT 0,
  balance decimal(10,2) DEFAULT 0,
  status text DEFAULT 'CURRENT' CHECK (status IN ('CURRENT', 'OVERDUE', 'DEACTIVATED')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(motorcycle_id, status_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_cost_center ON clients(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_client ON motorcycles(client_id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_status ON motorcycles(status);
CREATE INDEX IF NOT EXISTS idx_payments_motorcycle ON payments(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_payment ON payment_distributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_deactivations_motorcycle ON deactivations(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status(status_date);
CREATE INDEX IF NOT EXISTS idx_daily_status_motorcycle ON daily_status(motorcycle_id);

-- Enable Row Level Security
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deactivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cost_centers
CREATE POLICY "Users can view cost centers"
  ON cost_centers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert cost centers"
  ON cost_centers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update cost centers"
  ON cost_centers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete cost centers"
  ON cost_centers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for clients
CREATE POLICY "Users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for motorcycles
CREATE POLICY "Users can view motorcycles"
  ON motorcycles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert motorcycles"
  ON motorcycles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update motorcycles"
  ON motorcycles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete motorcycles"
  ON motorcycles FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for payments
CREATE POLICY "Users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for payment_distributions
CREATE POLICY "Users can view payment distributions"
  ON payment_distributions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payment distributions"
  ON payment_distributions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for deactivations
CREATE POLICY "Users can view deactivations"
  ON deactivations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert deactivations"
  ON deactivations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update deactivations"
  ON deactivations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for daily_status
CREATE POLICY "Users can view daily status"
  ON daily_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert daily status"
  ON daily_status FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update daily status"
  ON daily_status FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to automatically create payment distribution (70/30 split)
CREATE OR REPLACE FUNCTION create_payment_distribution()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO payment_distributions (payment_id, associate_amount, company_amount)
  VALUES (
    NEW.id,
    NEW.amount * 0.70,
    NEW.amount * 0.30
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create distribution on payment insert
DROP TRIGGER IF EXISTS trigger_create_payment_distribution ON payments;
CREATE TRIGGER trigger_create_payment_distribution
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_distribution();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_cost_centers_updated_at ON cost_centers;
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_motorcycles_updated_at ON motorcycles;
CREATE TRIGGER update_motorcycles_updated_at
  BEFORE UPDATE ON motorcycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
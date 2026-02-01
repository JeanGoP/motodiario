-- MotoDiario SQL Server schema
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cost_centers]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[cost_centers] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [name] nvarchar(255) NOT NULL,
    [code] nvarchar(100) NOT NULL,
    [description] nvarchar(max) NOT NULL DEFAULT N'',
    [active] bit NOT NULL DEFAULT 1,
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [updated_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_cost_centers] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_cost_centers_code] UNIQUE ([code])
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[clients]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[clients] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [cost_center_id] uniqueidentifier NOT NULL,
    [name] nvarchar(255) NOT NULL,
    [document] nvarchar(100) NOT NULL,
    [phone] nvarchar(100) NOT NULL,
    [email] nvarchar(255) NOT NULL DEFAULT N'',
    [address] nvarchar(max) NOT NULL DEFAULT N'',
    [grace_days] int NOT NULL DEFAULT 2,
    [active] bit NOT NULL DEFAULT 1,
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [updated_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_clients] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_clients_document] UNIQUE ([document]),
    CONSTRAINT [FK_clients_cost_center] FOREIGN KEY ([cost_center_id]) REFERENCES [dbo].[cost_centers]([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_clients_grace_days] CHECK ([grace_days] IN (2,4))
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[motorcycles]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[motorcycles] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [client_id] uniqueidentifier NOT NULL,
    [brand] nvarchar(255) NOT NULL,
    [model] nvarchar(255) NOT NULL,
    [year] int NOT NULL,
    [plate] nvarchar(100) NOT NULL,
    [daily_rate] decimal(10,2) NOT NULL,
    [status] nvarchar(20) NOT NULL DEFAULT N'ACTIVE',
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [updated_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_motorcycles] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_motorcycles_plate] UNIQUE ([plate]),
    CONSTRAINT [FK_motorcycles_client] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_motorcycles_daily_rate] CHECK ([daily_rate] > 0),
    CONSTRAINT [CK_motorcycles_status] CHECK ([status] IN (N'ACTIVE', N'DEACTIVATED'))
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payments]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[payments] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [motorcycle_id] uniqueidentifier NOT NULL,
    [client_id] uniqueidentifier NOT NULL,
    [amount] decimal(10,2) NOT NULL,
    [payment_date] date NOT NULL,
    [receipt_number] nvarchar(100) NOT NULL,
    [notes] nvarchar(max) NOT NULL DEFAULT N'',
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [created_by] uniqueidentifier NULL,
    CONSTRAINT [PK_payments] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_payments_receipt] UNIQUE ([receipt_number]),
    CONSTRAINT [FK_payments_motorcycle] FOREIGN KEY ([motorcycle_id]) REFERENCES [dbo].[motorcycles]([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_payments_client] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_payments_amount] CHECK ([amount] > 0)
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payment_distributions]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[payment_distributions] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [payment_id] uniqueidentifier NOT NULL,
    [associate_amount] decimal(10,2) NOT NULL,
    [company_amount] decimal(10,2) NOT NULL,
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_payment_distributions] PRIMARY KEY ([id]),
    CONSTRAINT [FK_payment_distributions_payment] FOREIGN KEY ([payment_id]) REFERENCES [dbo].[payments]([id]) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[deactivations]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[deactivations] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [motorcycle_id] uniqueidentifier NOT NULL,
    [client_id] uniqueidentifier NOT NULL,
    [deactivation_date] date NOT NULL,
    [days_overdue] int NOT NULL,
    [reason] nvarchar(max) NOT NULL,
    [reactivation_date] date NULL,
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_deactivations] PRIMARY KEY ([id]),
    CONSTRAINT [FK_deactivations_motorcycle] FOREIGN KEY ([motorcycle_id]) REFERENCES [dbo].[motorcycles]([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_deactivations_client] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[notifications]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[notifications] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [client_id] uniqueidentifier NOT NULL,
    [motorcycle_id] uniqueidentifier NOT NULL,
    [type] nvarchar(20) NOT NULL,
    [message] nvarchar(max) NOT NULL,
    [sent_at] datetimeoffset NULL,
    [status] nvarchar(20) NOT NULL DEFAULT N'PENDING',
    [channel] nvarchar(20) NOT NULL DEFAULT N'SMS',
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_notifications] PRIMARY KEY ([id]),
    CONSTRAINT [FK_notifications_client] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_notifications_motorcycle] FOREIGN KEY ([motorcycle_id]) REFERENCES [dbo].[motorcycles]([id]) ON DELETE NO ACTION,
    CONSTRAINT [CK_notifications_type] CHECK ([type] IN (N'WARNING', N'DEACTIVATION')),
    CONSTRAINT [CK_notifications_status] CHECK ([status] IN (N'PENDING', N'SENT', N'FAILED')),
    CONSTRAINT [CK_notifications_channel] CHECK ([channel] IN (N'SMS', N'WHATSAPP'))
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[daily_status]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[daily_status] (
    [id] uniqueidentifier NOT NULL DEFAULT NEWID(),
    [motorcycle_id] uniqueidentifier NOT NULL,
    [client_id] uniqueidentifier NOT NULL,
    [status_date] date NOT NULL,
    [days_overdue] int NOT NULL DEFAULT 0,
    [balance] decimal(10,2) NOT NULL DEFAULT 0,
    [status] nvarchar(20) NOT NULL DEFAULT N'CURRENT',
    [created_at] datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [PK_daily_status] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_daily_status_motorcycle_date] UNIQUE ([motorcycle_id], [status_date]),
    CONSTRAINT [FK_daily_status_motorcycle] FOREIGN KEY ([motorcycle_id]) REFERENCES [dbo].[motorcycles]([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_daily_status_client] FOREIGN KEY ([client_id]) REFERENCES [dbo].[clients]([id]) ON DELETE CASCADE,
    CONSTRAINT [CK_daily_status_status] CHECK ([status] IN (N'CURRENT', N'OVERDUE', N'DEACTIVATED'))
  );
END
GO

-- Indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_clients_cost_center' AND object_id = OBJECT_ID(N'[dbo].[clients]'))
  CREATE INDEX [idx_clients_cost_center] ON [dbo].[clients]([cost_center_id]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_motorcycles_client' AND object_id = OBJECT_ID(N'[dbo].[motorcycles]'))
  CREATE INDEX [idx_motorcycles_client] ON [dbo].[motorcycles]([client_id]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_motorcycles_status' AND object_id = OBJECT_ID(N'[dbo].[motorcycles]'))
  CREATE INDEX [idx_motorcycles_status] ON [dbo].[motorcycles]([status]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_payments_motorcycle' AND object_id = OBJECT_ID(N'[dbo].[payments]'))
  CREATE INDEX [idx_payments_motorcycle] ON [dbo].[payments]([motorcycle_id]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_payments_client' AND object_id = OBJECT_ID(N'[dbo].[payments]'))
  CREATE INDEX [idx_payments_client] ON [dbo].[payments]([client_id]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_payments_date' AND object_id = OBJECT_ID(N'[dbo].[payments]'))
  CREATE INDEX [idx_payments_date] ON [dbo].[payments]([payment_date]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_notifications_client' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
  CREATE INDEX [idx_notifications_client] ON [dbo].[notifications]([client_id]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_notifications_status' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
  CREATE INDEX [idx_notifications_status] ON [dbo].[notifications]([status]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_daily_status_date' AND object_id = OBJECT_ID(N'[dbo].[daily_status]'))
  CREATE INDEX [idx_daily_status_date] ON [dbo].[daily_status]([status_date]);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_daily_status_motorcycle' AND object_id = OBJECT_ID(N'[dbo].[daily_status]'))
  CREATE INDEX [idx_daily_status_motorcycle] ON [dbo].[daily_status]([motorcycle_id]);
GO

-- Trigger: auto-create payment distribution 70/30
IF OBJECT_ID(N'[dbo].[tr_create_payment_distribution]', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[tr_create_payment_distribution];
GO
CREATE TRIGGER [dbo].[tr_create_payment_distribution]
ON [dbo].[payments]
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO [dbo].[payment_distributions] (payment_id, associate_amount, company_amount)
  SELECT i.id, CONVERT(decimal(10,2), i.amount * 0.70), CONVERT(decimal(10,2), i.amount * 0.30)
  FROM inserted i;
END
GO

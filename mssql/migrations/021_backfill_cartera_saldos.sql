IF OBJECT_ID(N'[dbo].[cartera_saldos]', N'U') IS NOT NULL
  AND OBJECT_ID(N'[dbo].[motos]', N'U') IS NOT NULL
BEGIN
  DELETE FROM dbo.cartera_saldos;

  DECLARE @today date = CONVERT(date, SYSDATETIME());

  ;WITH motos_base AS (
    SELECT
      m.id AS motorcycle_id,
      m.empresa_id,
      m.asociado_id,
      CONVERT(date, m.created_at) AS start_date,
      CAST(m.daily_rate AS decimal(10,2)) AS daily_rate,
      CAST(ISNULL(p.total_paid, 0) AS decimal(18,2)) AS total_paid
    FROM dbo.motos m
    OUTER APPLY (
      SELECT SUM(CAST(amount AS decimal(18,2))) AS total_paid
      FROM dbo.pagos p
      WHERE p.empresa_id = m.empresa_id
        AND p.motorcycle_id = m.id
    ) p
    WHERE CAST(m.daily_rate AS decimal(18,2)) > 0
  ),
  motos_calc AS (
    SELECT
      mb.*,
      DATEDIFF(day, mb.start_date, @today) + 1 AS days_due,
      CAST(FLOOR(mb.total_paid / NULLIF(mb.daily_rate, 0)) AS int) AS full_days_paid,
      (mb.total_paid - (FLOOR(mb.total_paid / NULLIF(mb.daily_rate, 0)) * mb.daily_rate)) AS remainder_paid
    FROM motos_base mb
  ),
  nums AS (
    SELECT TOP (40000)
      ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
  ),
  cartera_rows AS (
    SELECT
      mc.empresa_id,
      mc.motorcycle_id,
      mc.asociado_id,
      nums.n AS cuota_num,
      DATEADD(day, nums.n - 1, mc.start_date) AS cuota_fecha,
      mc.daily_rate AS valor_cuota,
      CASE
        WHEN nums.n <= mc.full_days_paid THEN mc.daily_rate
        WHEN nums.n = mc.full_days_paid + 1 AND mc.remainder_paid > 0 THEN mc.remainder_paid
        ELSE CAST(0 AS decimal(10,2))
      END AS pagado
    FROM motos_calc mc
    INNER JOIN nums ON nums.n BETWEEN 1 AND mc.days_due
    WHERE mc.days_due > 0
  )
  INSERT INTO dbo.cartera_saldos (
    id,
    empresa_id,
    motorcycle_id,
    asociado_id,
    cuota_num,
    cuota_fecha,
    valor_cuota,
    pagado,
    saldo,
    estado,
    creado_en,
    actualizado_en
  )
  SELECT
    NEWID(),
    r.empresa_id,
    r.motorcycle_id,
    r.asociado_id,
    r.cuota_num,
    r.cuota_fecha,
    r.valor_cuota,
    r.pagado,
    CASE WHEN r.pagado >= r.valor_cuota THEN CAST(0 AS decimal(10,2)) ELSE (r.valor_cuota - r.pagado) END AS saldo,
    CASE WHEN r.pagado >= r.valor_cuota THEN N'PAGADA' WHEN r.pagado > 0 THEN N'PARCIAL' ELSE N'PENDIENTE' END AS estado,
    SYSDATETIMEOFFSET(),
    SYSDATETIMEOFFSET()
  FROM cartera_rows r;
END
GO

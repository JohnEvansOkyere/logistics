-- Each quote version defines its own container-size labels rather than relying
-- on fixed 20ft/40ft columns.

ALTER TABLE app.quote_version
  ADD COLUMN size_labels text[] NOT NULL DEFAULT '{}'
    CONSTRAINT quote_version_size_labels CHECK (cardinality(size_labels) <= 4);

ALTER TABLE app.quote_line
  ADD COLUMN size_amounts_minor bigint[]
    CONSTRAINT quote_line_size_amounts CHECK (
      size_amounts_minor IS NULL OR (
        cardinality(size_amounts_minor) BETWEEN 1 AND 4
        AND array_position(size_amounts_minor, NULL) IS NULL
        AND 0 <= ALL (size_amounts_minor)
        AND 1000000000000 >= ALL (size_amounts_minor)
      )
    );

-- Carry existing quotes over, including issued ones (their triggers are
-- switched off only for this copy; the amounts themselves do not change).
ALTER TABLE app.quote_line DISABLE TRIGGER quote_line_protect_issued;
ALTER TABLE app.quote_version DISABLE TRIGGER quote_version_protect_issued;

UPDATE app.quote_line
SET size_amounts_minor = ARRAY[amount_20ft_minor, amount_40ft_minor]
WHERE amount_20ft_minor IS NOT NULL;

UPDATE app.quote_version v
SET size_labels = ARRAY['20ft', '40ft']
WHERE EXISTS (
  SELECT 1 FROM app.quote_line l
  WHERE l.version_id = v.version_id AND l.size_amounts_minor IS NOT NULL
);

ALTER TABLE app.quote_version ENABLE TRIGGER quote_version_protect_issued;
ALTER TABLE app.quote_line ENABLE TRIGGER quote_line_protect_issued;

ALTER TABLE app.quote_line
  DROP CONSTRAINT quote_line_amount_form,
  DROP CONSTRAINT quote_line_amount_required,
  DROP COLUMN amount_20ft_minor,
  DROP COLUMN amount_40ft_minor,
  -- One amount, or an amount per size column; never both forms.
  ADD CONSTRAINT quote_line_amount_form CHECK (
    amount_minor IS NULL OR size_amounts_minor IS NULL
  ),
  -- Only at-cost lines may omit the amount (the actual invoice sets it).
  ADD CONSTRAINT quote_line_amount_required CHECK (
    basis = 'at_cost'
    OR amount_minor IS NOT NULL
    OR size_amounts_minor IS NOT NULL
  );

CREATE FUNCTION app.check_quote_version_size_labels()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.size_labels) AS labels(size_label)
    GROUP BY lower(btrim(size_label))
    HAVING min(btrim(size_label)) = '' OR count(*) > 1
  ) THEN
    RAISE EXCEPTION 'quote size labels must be non-empty and unique'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.quote_line AS line
    WHERE line.version_id = NEW.version_id
      AND line.size_amounts_minor IS NOT NULL
      AND cardinality(line.size_amounts_minor) <> cardinality(NEW.size_labels)
  ) THEN
    RAISE EXCEPTION 'quote line amounts must match the version size labels'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_quote_version_size_labels()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_version_size_labels_check
  BEFORE INSERT OR UPDATE OF size_labels ON app.quote_version
  FOR EACH ROW
  EXECUTE FUNCTION app.check_quote_version_size_labels();

CREATE FUNCTION app.check_quote_line_size_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  label_count integer;
BEGIN
  IF NEW.size_amounts_minor IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT cardinality(size_labels) INTO label_count
  FROM app.quote_version WHERE version_id = NEW.version_id;
  IF label_count IS NULL OR label_count = 0
    OR cardinality(NEW.size_amounts_minor) <> label_count THEN
    RAISE EXCEPTION 'quote line amounts must match the version size labels'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_quote_line_size_amounts()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_line_size_amounts_check
  BEFORE INSERT OR UPDATE OF version_id, size_amounts_minor ON app.quote_line
  FOR EACH ROW
  EXECUTE FUNCTION app.check_quote_line_size_amounts();

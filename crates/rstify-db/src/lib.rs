pub mod pool;
pub mod repositories;

use rstify_core::error::CoreError;

/// True if the error is a UNIQUE-constraint violation. Uses the driver's error
/// classification rather than matching on the message text (which was fragile).
pub fn is_unique_violation(e: &sqlx::Error) -> bool {
    matches!(e, sqlx::Error::Database(db) if db.is_unique_violation())
}

/// Classify a sqlx error into a CoreError so handlers return meaningful status
/// codes: a UNIQUE-constraint violation becomes AlreadyExists (409) and a missing
/// row becomes NotFound (404), instead of every DB error collapsing to a 500.
pub fn map_sqlx_err(e: sqlx::Error) -> CoreError {
    if is_unique_violation(&e) {
        return CoreError::AlreadyExists(
            "A resource with these details already exists".to_string(),
        );
    }
    match e {
        sqlx::Error::RowNotFound => CoreError::NotFound("Resource not found".to_string()),
        _ => CoreError::Database(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn row_not_found_maps_to_not_found() {
        assert!(matches!(
            map_sqlx_err(sqlx::Error::RowNotFound),
            CoreError::NotFound(_)
        ));
    }

    #[test]
    fn other_errors_map_to_database() {
        // A non-database, non-RowNotFound error falls through to Database.
        assert!(matches!(
            map_sqlx_err(sqlx::Error::PoolClosed),
            CoreError::Database(_)
        ));
    }
}

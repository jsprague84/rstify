use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub fn verify_gitea_signature(secret: &str, body: &[u8], provided_hex: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    let computed = mac.finalize().into_bytes();
    let computed_hex: String = computed.iter().map(|b| format!("{:02x}", b)).collect();
    constant_time_eq(computed_hex.as_bytes(), provided_hex.as_bytes())
}

pub fn verify_github_signature(secret: &str, body: &[u8], header_value: &str) -> bool {
    let provided_hex = match header_value.strip_prefix("sha256=") {
        Some(hex) => hex,
        None => return false,
    };
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    let computed = mac.finalize().into_bytes();
    let computed_hex: String = computed.iter().map(|b| format!("{:02x}", b)).collect();
    constant_time_eq(computed_hex.as_bytes(), provided_hex.as_bytes())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gitea_signature_valid() {
        let body = b"{\"action\":\"push\"}";
        let secret = "mysecret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let expected: String = mac
            .finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect();
        assert!(verify_gitea_signature(secret, body, &expected));
    }

    #[test]
    fn test_gitea_signature_invalid() {
        assert!(!verify_gitea_signature("secret", b"body", "wrong"));
    }

    #[test]
    fn test_github_signature_valid() {
        let body = b"{\"action\":\"push\"}";
        let secret = "mysecret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let hex: String = mac
            .finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect();
        let header = format!("sha256={}", hex);
        assert!(verify_github_signature(secret, body, &header));
    }

    #[test]
    fn test_github_signature_no_prefix() {
        assert!(!verify_github_signature("secret", b"body", "noprefixhex"));
    }
}

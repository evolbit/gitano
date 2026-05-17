use sha2::{Digest, Sha256};

pub(super) fn gravatar_avatar_url(email: &str) -> Option<String> {
    let normalized_email = email.trim().to_lowercase();
    if normalized_email.is_empty() {
        return None;
    }

    let hash = Sha256::digest(normalized_email.as_bytes());
    Some(format!(
        "https://www.gravatar.com/avatar/{:x}?s=40&d=404",
        hash
    ))
}

pub(super) fn author_initial(author: &str) -> String {
    author
        .trim()
        .chars()
        .find(|ch| ch.is_alphanumeric())
        .map(|ch| ch.to_uppercase().to_string())
        .unwrap_or_else(|| "?".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    mod author_initial {
        use super::*;

        #[test]
        fn returns_the_first_alphanumeric_character_uppercased() {
            assert_eq!(author_initial("  -ada"), "A");
        }

        #[test]
        fn falls_back_when_author_has_no_alphanumeric_characters() {
            assert_eq!(author_initial(" - "), "?");
        }
    }

    mod gravatar_avatar_url {
        use super::*;

        #[test]
        fn hashes_normalized_email_addresses() {
            let lower = gravatar_avatar_url("ada@example.invalid");
            let mixed = gravatar_avatar_url(" Ada@Example.Invalid ");

            assert_eq!(mixed, lower);
        }

        #[test]
        fn returns_none_for_blank_emails() {
            assert_eq!(gravatar_avatar_url("  "), None);
        }
    }
}

## ADDED Requirements

### Requirement: Local AI exposes model warmup metadata
The system SHALL expose warmup metadata for each supported local AI model so the UI can explain memory impact before a user keeps a model warm.

#### Scenario: Model catalog includes warmup metadata
- **WHEN** the frontend requests the local AI model catalog
- **THEN** each model entry MUST include an estimated warm memory value in GB
- **AND** each model entry MUST include a warm memory class

#### Scenario: Warm memory class is derived locally
- **WHEN** a model entry is produced from the curated registry
- **THEN** the memory class MUST be derived from Gitano-owned local catalog data
- **AND** the frontend MUST NOT maintain a separate model memory table

### Requirement: Local AI model warmup preferences are persisted
The system SHALL persist which downloaded local AI models the user wants Gitano to keep warm.

#### Scenario: User enables warmup for a downloaded model
- **WHEN** the user checks `Keep this model warm` for a downloaded supported model
- **THEN** the backend MUST persist that model id in local AI warm preferences
- **AND** future settings loads MUST show the checkbox as selected

#### Scenario: User disables warmup for a model
- **WHEN** the user clears `Keep this model warm` for a supported model
- **THEN** the backend MUST remove that model id from local AI warm preferences
- **AND** future warmup passes MUST NOT warm that model

#### Scenario: Warm model is deleted
- **WHEN** a model that is selected for warmup is deleted
- **THEN** the backend MUST remove that model id from warm preferences

#### Scenario: All models are deleted
- **WHEN** all downloaded supported local AI models have been deleted
- **THEN** the backend MUST clear all warm model preferences

### Requirement: Warmup memory warnings protect model selection
The system SHALL warn before enabling warmup when selected warm models may reserve a high amount of memory.

#### Scenario: Cumulative warm memory crosses baseline threshold
- **WHEN** the user enables warmup and the estimated cumulative warm memory exceeds 5 GB
- **THEN** the frontend MUST show a warning with the estimated memory total
- **AND** the user MUST explicitly confirm before the preference is persisted

#### Scenario: Warm memory is high relative to machine memory
- **WHEN** detected total memory is available and estimated cumulative warm memory exceeds a high share of total memory
- **THEN** the frontend MUST show a stronger warning before persisting the preference
- **AND** the user MUST be allowed to continue explicitly

#### Scenario: Total memory is unavailable
- **WHEN** detected total memory is unavailable
- **THEN** the frontend MUST still warn based on the estimated cumulative warm memory and memory class

### Requirement: Local AI settings can warm selected models
The system SHALL allow the settings surface to trigger warmup for installed models selected by warm preferences.

#### Scenario: Warmup is requested
- **WHEN** the frontend asks Gitano to warm configured models
- **THEN** the backend MUST start the managed runtime when installed
- **AND** the backend MUST send keep-alive warmup requests only for installed supported models selected in warm preferences

#### Scenario: Warmup fails for one model
- **WHEN** one selected model fails to warm
- **THEN** the settings modal MUST show the warmup failure inside the modal
- **AND** the failure MUST NOT clear the warm preference automatically

#### Scenario: Model is not downloaded
- **WHEN** a model is not downloaded
- **THEN** the settings UI MUST NOT allow `Keep this model warm` to be enabled for that model

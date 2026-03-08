# Apply the AddDescriptionMFRColumnsToComparisonCriteria migration manually
# Run this once from PowerShell when the app is running and the exe is locked.

$dbPath = "$env:LOCALAPPDATA\MarisPortal\marisportal.db"

$connStr = "Data Source=$dbPath"

Add-Type -Path (Get-ChildItem "$env:USERPROFILE\.nuget\packages\microsoft.data.sqlite.core" -Recurse -Filter "Microsoft.Data.Sqlite.dll" | Sort-Object FullName | Select-Object -Last 1).FullName

$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()

# Check if columns already exist
$cmd.CommandText = "PRAGMA table_info(ComparisonCriteria);"
$reader = $cmd.ExecuteReader()
$existingCols = @()
while ($reader.Read()) { $existingCols += $reader["name"] }
$reader.Close()

if ($existingCols -notcontains "ColDescription") {
    $cmd.CommandText = "ALTER TABLE ComparisonCriteria ADD COLUMN ColDescription TEXT;"
    $cmd.ExecuteNonQuery()
    Write-Host "Added ColDescription column."
} else {
    Write-Host "ColDescription already exists."
}

if ($existingCols -notcontains "ColMFR") {
    $cmd.CommandText = "ALTER TABLE ComparisonCriteria ADD COLUMN ColMFR TEXT;"
    $cmd.ExecuteNonQuery()
    Write-Host "Added ColMFR column."
} else {
    Write-Host "ColMFR already exists."
}

# Record migration in EF history table
$cmd.CommandText = "SELECT COUNT(*) FROM __EFMigrationsHistory WHERE MigrationId = '20260221215005_AddDescriptionMFRColumnsToComparisonCriteria';"
$count = $cmd.ExecuteScalar()
if ($count -eq 0) {
    $cmd.CommandText = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20260221215005_AddDescriptionMFRColumnsToComparisonCriteria', '8.0.13');"
    $cmd.ExecuteNonQuery()
    Write-Host "Migration recorded in EF history."
} else {
    Write-Host "Migration already recorded in EF history."
}

$conn.Close()
Write-Host "Done."

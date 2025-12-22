$server   = "DELLLAPTOP"
$database = "BigYearDB"
$outDir   = "C:\Users\tuejo\source\repos\BigYearPWA\Data\WeekStat"

# Ensure output directory exists
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$speciesClasses = @(
    "Mammalia",
    "Amphibia",
    "Insecta",
    "Aves",
    "Reptilia"
)

for ($week = 1; $week -le 52; $week++) {
    foreach ($class in $speciesClasses) {

        $file = Join-Path $outDir "$class-$week.json"

        # SQL query: cast JSON to VARCHAR(MAX) to avoid CR/LF issues
        $query = @"
SELECT CAST(
(
    SELECT
        sc.speciesid,
        sc.totalObservationCount AS obsCount,
        sc.totalIndividualCount AS indCount,
        sc.individualRatio       AS ratio,
        sc.rarityScore           AS rScore,
        sc.observationScore      AS oScore,
        s.sortCode,
        s.sortCodeInt,
        s.DanishName,
        s.speciesStatus
    FROM species_scored sc
    JOIN species s ON s.speciesid = sc.speciesid
    WHERE s.speciesclass = '$class'
      AND sc.weeknumber = $week
    ORDER BY s.sortCodeInt
    FOR JSON PATH, ROOT('species')
) AS VARCHAR(MAX)) AS JsonText
"@

        # Flatten the query and escape quotes
        $queryOneLine = $query -replace "`r|`n", " "
        $queryEscaped = $queryOneLine.Replace('"', '""')

        Write-Host "Creating $file"

        # Execute bcp
        Start-Process -NoNewWindow -Wait -FilePath "bcp" -ArgumentList @(
            "`"$queryEscaped`"",
            "queryout",
            "`"$file`"",
            "-w",
            "-T",
            "-S", $server,
            "-d", $database
        )
    }
}

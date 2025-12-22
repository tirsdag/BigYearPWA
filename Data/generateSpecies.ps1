$server   = "DELLLAPTOP"
$database = "BigYearDB"
$outDir   = "C:\Users\tuejo\source\repos\BigYearPWA\Data\Species"

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

    foreach ($class in $speciesClasses) {

        $file = Join-Path $outDir "SPECIES-$class.json"

        # SQL query: cast JSON to VARCHAR(MAX) to avoid CR/LF issues
        $query = @"
SELECT CAST(
(
select * from species s where s.speciestype in ('art', 'underart', 'andre_dyr') and s.speciesClass= '$class' ORDER BY s.sortCodeInt for json path, ROOT('species')
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

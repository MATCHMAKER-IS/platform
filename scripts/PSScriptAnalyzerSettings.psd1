@{
    # ============================================================================
    #  PSScriptAnalyzer 設定。setup.ps1 / setup.bat の CI 静的解析で使う。
    #  方針: セットアップスクリプトとして正当な書き方は除外し、本当の問題だけ検出する。
    #  実行: Invoke-ScriptAnalyzer -Path scripts/setup.ps1 -Settings scripts/PSScriptAnalyzerSettings.psd1
    # ============================================================================

    # 警告・エラーの両方を対象にする(除外ルールを引いた残りが対象)。
    Severity = @('Error', 'Warning')

    ExcludeRules = @(
        # コンソールに色付きで進捗を出すのはセットアップスクリプトの正当な用途。
        # 出力をパイプで受け渡す設計ではないため Write-Host を許容する。
        'PSAvoidUsingWriteHost',

        # Step / OK / Warn / Fail / DbName / Has は画面表示・内部判定用の短いヘルパ。
        # PowerShell の承認動詞(Get-/Set-/New- 等)を強制するとかえって読みにくくなるため除外。
        'PSUseApprovedVerbs',

        # 対話的な確認を挟まない全自動セットアップが目的のため、ShouldProcess は不要。
        'PSUseShouldProcessForStateChangingFunctions'
    )

    # 上記以外は既定どおり有効。特に検出したい本当の問題の例:
    #   平文パスワードの使用、平文からの SecureString 化、Invoke-Expression(コード注入リスク)、
    #   未使用変数(タイプミスの検出に有効)、エイリアス濫用、$null 比較の左右間違い など。
    #   これらのルール ID は上の ExcludeRules に載せないことで有効のままにしている。
}

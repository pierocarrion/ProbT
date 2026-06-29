"""Layer 2c — feature_diagnostics.py

Verifies multicollinearity BEFORE training. Mandatory checkpoint.

Inputs : data/daily_feature_matrix.csv
Outputs: data/correlation_matrix.png + data/vif_report.csv

Decision rules:
  VIF > 10            -> drop the feature OR document why it is kept
  |correlation| > 0.85 -> drop one of the pair (prefer the more interpretable)
"""
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from statsmodels.stats.outliers_influence import variance_inflation_factor

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
NON_FEATURES = ["label", "date", "open", "high", "low", "close", "volume"]


def main():
    df = pd.read_csv(os.path.join(DATA_DIR, "daily_feature_matrix.csv"),
                     parse_dates=True, index_col=0)
    feats = [c for c in df.columns if c not in NON_FEATURES]
    X = df[feats].astype(float).dropna()

    # ─── Correlation heatmap ───────────────────────────────────────
    corr = X.corr()
    plt.figure(figsize=(14, 10))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0,
                square=True, cbar_kws={"shrink": 0.8})
    plt.title("Feature correlation matrix")
    plt.tight_layout()
    plt.savefig(os.path.join(DATA_DIR, "correlation_matrix.png"), dpi=120)
    plt.close()

    # ─── Variance Inflation Factor ─────────────────────────────────
    vif_rows = []
    for i, col in enumerate(X.columns):
        try:
            v = float(variance_inflation_factor(X.values, i))
        except Exception:
            v = np.nan
        vif_rows.append({"feature": col, "vif": v})
    vif = pd.DataFrame(vif_rows).sort_values("vif", ascending=False).reset_index(drop=True)
    vif.to_csv(os.path.join(DATA_DIR, "vif_report.csv"), index=False)

    # ─── Warnings ──────────────────────────────────────────────────
    print("[feature_diagnostics] VIF report:")
    print(vif.to_string(index=False))
    high_vif = vif[vif["vif"] > 10]
    for _, r in high_vif.iterrows():
        print(f"  WARNING - alta multicolinealidad: {r['feature']}: VIF={r['vif']:.2f}")

    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    pairs = (
        upper.stack().reset_index()
        .rename(columns={"level_0": "a", "level_1": "b", 0: "corr"})
    )
    high_pairs = pairs[pairs["corr"].abs() > 0.85]
    for _, r in high_pairs.iterrows():
        print(f"  WARNING - correlacion alta: {r['a']} <-> {r['b']}: {r['corr']:.2f}")

    print(f"[feature_diagnostics] saved correlation_matrix.png + vif_report.csv")


if __name__ == "__main__":
    main()

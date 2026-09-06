# Beam Stress Distribution Calculator (`stress.structlab.tech`)

A browser-native civil and structural engineering calculator for analyzing and visualizing cross-sectional **Normal Stress ($\sigma$)**, **Jourawski Shear Stress ($\tau$)**, and **von Mises Combined Stress ($\sigma_{vM}$)** across standard structural beam profiles.

Part of the [StructLab.tech](https://structlab.tech) engineering educational ecosystem.

---

## Features

- **5 Core Structural Profiles:**
  - Solid Rectangle ($b \times h$)
  - Symmetric I-Beam ($h, b, t_w, t_f$)
  - Asymmetric T-Section ($b, h, t_f, t_w$)
  - Hollow Box / RHS ($B, H, t_w, t_f$)
  - Solid Circle ($D$)
- **4 Synchronized Diagrams with Elevation Probe:**
  - Cross-section geometry with centroid $\bar{y}$, Neutral Axis (N-A), and shaded dynamic cut area $A^*(y)$
  - Normal stress distribution $\sigma(y) = \frac{N}{A} - \frac{M \cdot y}{I_z}$ (tension in cyan, compression in red)
  - Jourawski shear stress distribution $\tau(y) = \frac{V \cdot S(y)}{I_z \cdot b(y)}$ with exact step jumps at flange-web junctions
  - von Mises combined yield envelope $\sigma_{vM}(y) = \sqrt{\sigma(y)^2 + 3\tau(y)^2}$ with material $f_y$ limit check
- **Interactive 2D Infinitesimal Stress Element & Mohr's Circle:**
  - Live infinitesimal element with normal stress arrows ($\sigma_x$) and shear arrows ($\tau_{xy}$)
  - Complete Mohr's circle visualization with principal stresses $\sigma_1, \sigma_2$, $\tau_{\max}$, and principal orientation angle $\theta_p$
- **Analytical Step-by-Step Proofs:**
  - High-precision LaTeX formula rendering via KaTeX with real values substituted for coursework and homework verification
- **Sharing & Export:**
  - One-click shareable URL with `#model=` compact state hash
  - Client-side QR code generator (`QRious`)
  - Export full diagrams as high-resolution PNG
  - Print-friendly PDF report generation
- **Bilingual Interface:**
  - Full English and Polish translations

---

## Theory & Sign Convention

- **Normal Stress:**
  $$\sigma(y) = \frac{N}{A} - \frac{M \cdot y}{I_z}$$
  * Tensile normal stress $\sigma > 0$ (positive, cyan)
  * Compressive normal stress $\sigma < 0$ (negative, rose/red)
  * Sagging bending moment $M > 0$ produces bottom tension ($y < 0 \implies \sigma > 0$) and top compression ($y > 0 \implies \sigma < 0$)

- **Jourawski Shear Stress:**
  $$\tau(y) = \frac{V \cdot S(y)}{I_z \cdot b(y)}$$
  Where $S(y) = \int_y^{y_{\text{top}}} \eta \cdot b(\eta) \, d\eta$ is the first moment of area of the portion above level $y$.
  At the flange-web junction $y_j$:
  $$\tau_{\text{flange}} = \frac{V \cdot S_j}{I_z \cdot b_{\text{flange}}}, \qquad \tau_{\text{web}} = \frac{V \cdot S_j}{I_z \cdot t_w}$$

- **von Mises Combined Stress:**
  $$\sigma_{vM}(y) = \sqrt{\sigma(y)^2 + 3\tau(y)^2} \le f_y$$

- **Principal Stresses:**
  $$\sigma_{1,2} = \frac{\sigma}{2} \pm \sqrt{\left(\frac{\sigma}{2}\right)^2 + \tau^2}, \qquad \theta_p = \frac{1}{2}\arctan\left(\frac{2\tau}{\sigma}\right)$$

---

## Running Locally

Simply serve with any static web server:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000`. Zero build tools or dependencies required.
